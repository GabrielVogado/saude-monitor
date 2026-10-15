# Plano de Escala da Infraestrutura para o DF — v1.0

> **Data:** 08/10/2026 · **Status:** 🟡 Proposta (aguarda decisões do PO, §8) · **Área:** infraestrutura e deploy
> **Pergunta do PO:** como migrar para uma estrutura barata que aguente o acesso simultâneo de quase toda a população do DF.
> **Decisão registrada como proposta em:** `08-analise tecnica/adrs.md` (ADR-015).

---

## 1. Resposta curta

Dá para atender o DF inteiro **sem trocar de nuvem e sem Kubernetes**, com uma conta de **~US$ 500–680/mês
no patamar de 80% da população instalada** (§5), desde que o mapa não continue no Mapbox pago por usuário ativo.
O que impede escalar hoje **não é dinheiro, são quatro travas no código e na configuração** (§3): o backend está
preso a **uma instância** por causa do seed, o rate limit por IP vai bloquear usuários reais atrás da mesma
operadora, os jobs agendados não são confiáveis no Cloud Run, e o banco é o **Atlas M0 gratuito, compartilhado com
o dev**, cujo teto (100 op/s) estoura a partir de ~250 pessoas usando o app ao mesmo tempo.

A estratégia é: **cache na borda para tudo que é público** (catálogo, ranking, indicadores), **Cloud Run escalando
horizontalmente só para o que é pessoal** (login, visitas, avaliações) e **banco dimensionado por patamar**, subindo
de plano quando a medição mandar, não antes.

> **Premissa que muda o tamanho do problema:** 3 milhões de pessoas **instaladas** não significam 3 milhões de
> requisições ao mesmo tempo. O plano dimensiona a partir de uma hipótese explícita de usuários ativos e de pico
> (§4), mostra o custo em cada patamar e trata o "todo mundo ao mesmo tempo" como um cenário de evento (P5/P6),
> absorvido pela borda. Todas as premissas são ajustáveis.

---

## 2. Estrutura atual (medida em 08/10/2026)

| Peça | Como está | Evidência |
|---|---|---|
| Backend | Cloud Run `southamerica-east1`, 1 vCPU, 1 GiB, `--min-instances=0`, **`--max-instances=1`**, timeout 60 s, concorrência padrão | `.github/workflows/cd-backend-google.yml` (flags do deploy) |
| Ambientes | `develop` → dev · `master` → homologação · `release/**` → produção (`_PROD`), sem evidência de que a produção já exista | `deploy/google/README.md` |
| Banco | MongoDB **Atlas M0** (gratuito) em `AWS / sa-east-1`; o cluster da homologação é **o mesmo do dev** | `perf/README.md`, ADR-011 |
| Runtime | Java 25 com virtual threads; BCrypt custo 10 no login; JWT de 15 min + refresh de 30 dias | `application.properties` |
| Seed | `SeedRunner` importa DBF/SHP **no startup**, com *check-then-act* sobre `count()` | `SeedRunner.java` |
| Rate limit | Em memória (`ConcurrentHashMap`), **por IP**: 10 login/min e 60 req/min públicas em dev e produção | `RateLimitService.java`, `cd-backend-google.yml` |
| Jobs | 4 `@Scheduled` de 15 min dentro da aplicação (agregados, feedback sem resposta, expiração, GPS interrompido) | `*Job.java` |
| Cache | Nenhum cache de aplicação nem de borda; só `/api/v1/camadas/{tipo}` manda `Cache-Control` (1 dia) | `RegiaoController.java` |
| E-mail | Resend no plano gratuito (100/dia) — usado na **confirmação do cadastro** e no "esqueci a senha" | `UserServiceImpl.java`, relatório de desempenho |
| Mapa (app) | `@rnmapbox/maps` v10, cobrado por usuário ativo mensal (MAU) do SDK | `Arvore-Tecnologica-v2.1.md` |
| CI/CD | GitHub Actions, imagem no Artifact Registry, WIF sem chave, smoke tests de Mongo e índice 2dsphere | `cd-backend-google.yml` |

**O que já foi medido de carga** (`11-desempenho/Relatorio-Desempenho-HML-2026-09-23.md`): 100 usuários fazendo a
jornada completa numa instância de 1 vCPU, **0 erros, p95 157 ms**; login p95 310 ms (BCrypt); **41 operações no
Mongo e 12 requisições por jornada**; pico de **39 op/s** no M0 (teto 100). Ninguém mediu ainda **quantas
requisições por segundo uma instância aguenta** — esse número é a primeira coisa do teste da Fase 4.

**O que está bom e fica:** Cloud Run (escala a zero e escala para dezenas de instâncias sem mudar nada no
container), região São Paulo, WIF, Secret Manager, smoke tests, k6 + Prometheus + Grafana em `perf/`.

---

## 3. O que impede escalar hoje

Ordem = o que quebra primeiro quando a carga sobe.

| # | Trava | Por que quebra | Correção proposta |
|---|---|---|---|
| T1 | **Atlas M0 compartilhado com dev** | Teto de 100 op/s; a 41 op/jornada, ~250 pessoas simultâneas estrangulam o cluster — e o dev/HML junto | Cluster próprio de produção (Flex → M10 → M20, §5); dev e HML ficam no M0 |
| T2 | **`--max-instances=1`** | É trava de segurança do seed (dois cold starts importariam o DBF/SHP duas vezes). Uma instância de 1 vCPU é o teto de todo o sistema | Tirar o seed e os reconciliadores do startup: virar um **Cloud Run Job** que o CD executa após o deploy, com upsert por `codigoCnes` (índice único). Startup fica mais curto (menos cold start) |
| T3 | **Rate limit por IP em memória** | (a) Operadoras móveis no Brasil usam CGNAT: milhares de celulares saem pelo mesmo IP e o limite de 60 req/min/IP vai devolver **429 para gente de verdade** justamente no pico. (b) Com N instâncias, cada uma conta sozinha | Rate limit **na borda** (Cloudflare ou Cloud Armor) para login e abuso; na aplicação, limite **por usuário autenticado** (`sub` do JWT) em vez de por IP |
| T4 | **Jobs `@Scheduled` no Cloud Run** | Com CPU estrangulada entre requisições, o disparo não é garantido (ADR-011 já registrava como risco não medido); com N instâncias, cada job roda N vezes | **Cloud Scheduler** chamando endpoints internos protegidos por OIDC (1 execução por vez, funciona com escala a zero; ~US$ 0,10/mês) |
| T5 | **Catálogo sem cache** | A lista por raio recebe lat/long exatos na URL: cada usuário é uma chave diferente, nada é cacheável. 78% das operações no Mongo são `find` de leitura pública | Catálogo do DF (~341 estabelecimentos) servido como **um recurso cacheável com ETag**; o app filtra por distância localmente (ou coordenadas arredondadas numa grade de ~1 km). Ranking e indicadores mudam a cada 15 min (job de agregados): `Cache-Control: public, s-maxage=300` |
| T6 | **Cold start com 503** | `min-instances=0` devolve 503 em ~15 s na primeira requisição (ADR-011) | Produção com `min-instances=1` (2 a partir do patamar P3) e `--cpu-boost` no startup |
| T7 | **Pool do Mongo × limite de conexões** | Cada instância abre até 100 conexões (padrão do driver). 30 instâncias × 100 = 3.000, o limite inteiro de um M20 | `maxPoolSize=20` na URI de produção |
| T8 | **E-mail no plano gratuito** | 100 e-mails/dia: no lançamento, o 101º cadastro do dia não recebe o código e **não consegue entrar** | Resend pago a partir do lançamento público (§5) |
| T9 | **Custo do Mapbox por MAU** | Cobra por usuário ativo do SDK: é a única linha da conta que cresce linearmente com a população e passa a ser a maior de todas a partir de P2 (§5) | Decisão do PO (§8): manter Mapbox com teto de gasto, ou voltar a MapLibre com tiles próprios (PMTiles num bucket com egress gratuito) |
| T10 | **Sem alerta nem teto de gasto** | Nada avisa quando o p95 sobe, quando dá 5xx ou quando a conta dispara | Alertas de orçamento no GCP e no Atlas, `--max-instances` como teto de custo, uptime check e alerta de 5xx/latência no Cloud Monitoring (gratuito nesse volume) |

**O que fica de fora de propósito** (caro e desnecessário para este volume): GKE/Kubernetes, microsserviços,
Redis/Memorystore (≥ ~US$ 35/mês só para existir — o cache na borda e o rate limit na borda cobrem o que ele
faria), multi-região e banco autogerenciado em VM.

---

## 4. Modelo de carga (premissas ajustáveis)

### 4.1 Premissas

| Premissa | Valor | De onde vem |
|---|---|---|
| População do DF | **3,0 milhões** | Estimativa IBGE (Censo 2022: 2,82 mi) — arredondada para cima |
| Usuários ativos no dia (DAU) | **10% dos instalados** | Hipótese: app utilitário, aberto quando se precisa de atendimento |
| Sessões na hora de pico | **15% do DAU** | Hipótese: concentração no início da manhã e no fim da tarde |
| Requisições por sessão | **12** | **Medido** (1.200 req / 100 jornadas, relatório de 23/09) |
| Operações no Mongo por sessão | **41** | **Medido** (4.135 op / 100 jornadas) |
| Duração da sessão | 5 min | Hipótese |
| Rajada (minuto de pico ÷ média da hora) | 3× | Hipótese conservadora |
| Fração servida pela borda com o cache da T5 | ~40% das requisições, ~55% das leituras no Mongo | Estimativa: 5 das 12 chamadas da jornada são públicas (lista, raio, detalhe, ranking, indicadores) |

A jornada medida é **pesada em escrita** (todo usuário faz check-in, heartbeat, checkout e avaliação). Na vida real
a maioria só consulta, então os números de escrita abaixo são um teto, não uma média.

**Fórmulas** (S = sessões na hora de pico = DAU × 0,15):
requisições/s no pico = S × 12 ÷ 3.600 × 3 · usuários simultâneos = S × 5 ÷ 60 · op/s no Mongo = S × 41 ÷ 3.600 × 3.

### 4.2 Patamares

| Patamar | Instalações (% do DF) | DAU | Simultâneos no pico | Req/s no pico (total) | Req/s na origem (com borda) | Op/s no Mongo (com cache) |
|---|---|---|---|---|---|---|
| **P1** Lançamento | 30 mil (1%) | 3 mil | ~40 | ~5 | ~3 | ~7 |
| **P2** Adoção | 300 mil (10%) | 30 mil | ~375 | ~45 | ~27 | ~70 |
| **P3** Massa | 900 mil (30%) | 90 mil | ~1.100 | ~135 | ~80 | ~210 |
| **P4** Quase todo o DF | 2,4 mi (80%) | 240 mil | ~3.000 | ~360 | ~215 | ~550 |
| **P5** Evento (crise sanitária, campanha do GDF) | 2,4 mi | 600 mil abrem na mesma hora | ~50.000 | ~6.000 | ~800 ¹ | ~2.400 ¹ |
| **P6** Literal: 3 mi abrindo no mesmo minuto | 3 mi | — | 3.000.000 | ~50.000 | só borda ² | — |

¹ No evento, ~90% das sessões só consultam (qual hospital está mais vazio?): servidas pela borda depois de um
*refresh* do token. Origem = 0,9 × 1 + 0,1 × 7 requisições por sessão.
² Não é um cenário de dimensionamento, é o teste de sanidade: 50 mil req/s de leitura pública são absorvidas por
uma CDN sem custo adicional; as escritas são limitadas **fisicamente** — só faz check-in quem está dentro de um dos
~341 estabelecimentos. Mesmo com 50 mil pessoas dentro de unidades de saúde ao mesmo tempo e heartbeat a cada
10 min com o app fechado (M-038), são ~85 escritas/s.

### 4.3 Capacidade por instância (a medir)

Hipótese de partida, a confirmar no teste da Fase 4: **~80 req/s por instância de 1 vCPU** para os endpoints
comuns (p95 no servidor entre 28 e 111 ms, quase tudo espera de I/O, virtual threads) e **~10 logins/s por vCPU**
(BCrypt ≈ 100 ms de CPU). Com folga de 50%: P1–P2 = 1 instância, P3 = 2–3, P4 = 4–5, P5 = 15–20 (até ~70 se a
borda não segurar o catálogo).

---

## 5. Custo estimado por patamar (US$/mês)

Preços de lista de outubro/2026; **conferir na calculadora antes de contratar**. São Paulo custa mais que os
EUA: no Atlas, a própria documentação cita o M30 a US$ 0,98/h em São Paulo contra US$ 0,54/h na Virgínia (~1,8×);
os valores do M10/M20 abaixo aplicam o mesmo fator e são estimativas.

| Componente | P1 | P2 | P3 | P4 | P5 (por dia de evento) |
|---|---|---|---|---|---|
| Cloud Run (prod) | 15–70 ³ | 30–80 | 80–160 | 150–300 | +20–60 |
| MongoDB Atlas (prod) | Flex 8–15 | Flex 15–30 | M10 ~105 | M20 ~260 | M30 por algumas horas: +10–25 |
| Borda (Cloudflare Free) | 0 | 0 | 0 | 0 | 0 |
| ↳ alternativa GCP (LB + Cloud CDN + Cloud Armor) | ~25 | ~30 | ~60 | ~150 | + tráfego |
| Cloud Scheduler, Logging, Monitoring | ~0 | ~0 | ~0–10 | ~10–30 | — |
| Resend (e-mail) | 20 | 20–35 | 35–90 | 90 | — |
| Domínio | ~1 | ~1 | ~1 | ~1 | — |
| **Total sem Mapbox** | **~45–105** | **~65–150** | **~220–360** | **~500–680** | **+30–85** |
| Mapbox (MAU ≈ 3× DAU) ⁴ | ~0 | +~500 | +~1.700 | +~4.700 | — |

³ A faixa de baixo é `min-instances=1` com cobrança por requisição (instância ociosa a preço reduzido); a de cima é
CPU sempre alocada.
⁴ Ordem de grandeza com a franquia gratuita de 25 mil MAU e ~US$ 4 por mil MAU acima dela — **valores não
confirmados nesta análise**: conferir em mapbox.com/pricing. Mesmo que o preço real seja metade, o mapa vira a maior
linha da conta a partir de P2.

**Leitura da tabela:** a infraestrutura em si cresce devagar (o cache na borda achata a curva) e o banco é a única
peça que sobe de degrau. Comparado ao custo de hoje (~US$ 0), o salto obrigatório para lançar publicamente é de
~US$ 50–100/mês (P1), e só passa disso quando o uso real aparecer nas métricas.

---

## 6. Arquitetura-alvo

```
 App (Expo)  ──┐                          ┌──────────── leitura pública (catálogo, ranking,
 Painel admin ─┤                          │             indicadores, camadas): cache 5 min–1 dia
               ▼                          │
     api.<domínio>  ──►  BORDA (Cloudflare Free ou LB + Cloud CDN + Cloud Armor)
                          · TLS, WAF, anti-DDoS
                          · rate limit de login e de abuso (não por IP de operadora)
                          · cache por Cache-Control/ETag
                                     │  só o que é pessoal ou escrita
                                     ▼
                 Cloud Run  saude-monitor-backend  (southamerica-east1)
                 min 1–2 · max 20 (teto de custo; P5 sobe por runbook) · cpu-boost
                 maxPoolSize=20 · rate limit por usuário autenticado
                     │                         ▲
                     ▼                         │ OIDC, 1 execução por vez
          MongoDB Atlas (prod, sa-east-1)   Cloud Scheduler ── 4 jobs de 15 min
          Flex → M10 → M20, auto-scaling    Cloud Run Job  ── seed + reconciliações (pós-deploy)
          dev/HML continuam no M0
```

Uma decisão que precisa vir **antes do lançamento**: o app passa a apontar para **um domínio próprio** e não para a
URL `*.run.app`. A URL da API vai embutida no APK; com domínio próprio, trocar o que está atrás dele (borda, região,
provedor) deixa de exigir uma versão nova do app.

---

## 7. Plano de migração em fases

Cada item é um PR próprio para `develop`, com testes e o roteamento de qualidade de sempre. As fases 0–2 podem
correr em paralelo; a 3 depende da 1 e da 2; a 4 valida tudo antes do lançamento público.

### Fase 0 — Higiene e guarda-corpos (custo zero)
- [ ] Alertas de orçamento no GCP (50/90/100%) e no Atlas.
- [ ] Log de início/fim nos 4 jobs, para medir se disparam hoje (T4 ainda não é observável).
- [ ] Uptime check e alertas de 5xx e de p95 no Cloud Monitoring.
- **Saída:** alguém é avisado antes de a conta ou a latência fugirem do previsto.

### Fase 1 — Destravar a escala horizontal (código)
- [ ] Seed e reconciliadores fora do startup: Cloud Run Job executado pelo CD após o deploy, upsert por `codigoCnes` com índice único (T2).
- [ ] Jobs agendados expostos como endpoints internos com OIDC e chamados pelo Cloud Scheduler (T4).
- [ ] Rate limit da aplicação por usuário autenticado; IP só como último recurso e com limite alto (T3).
- [ ] `Cache-Control`/`ETag` nos endpoints públicos; catálogo cacheável e filtro de distância no app (T5) — exige versão nova do APK.
- [ ] `maxPoolSize` explícito (T7).
- **Saída:** `--max-instances` pode subir sem risco de corrida; testes de integração cobrindo o seed idempotente.

### Fase 2 — Borda e domínio
- [ ] Registrar domínio e apontar `api.<domínio>` para a borda. Primeiro passo: **prova de conceito de 1 dia** com Cloudflare Free na frente do Cloud Run (confirmar a reescrita do cabeçalho `Host` e o mapeamento de domínio na região); se não fechar, usar o Load Balancer do GCP com *serverless NEG* (§5, linha alternativa).
- [ ] Regras de cache, WAF e rate limit de login na borda.
- [ ] App e painel apontando para o domínio (nova versão do APK).
- **Saída:** leituras públicas com taxa de acerto de cache medida > 80%.

### Fase 3 — Ambiente de produção
- [ ] Cluster Atlas de produção (Flex para P1; ativar auto-scaling quando virar M10+), em `sa-east-1` — mesma região do atual; avaliar Atlas no GCP `southamerica-east1` para evitar tráfego entre nuvens.
- [ ] Secrets `_PROD`, serviço `saude-monitor-backend` com `min-instances=1`, `max-instances=20`, `--cpu-boost`.
- [ ] Resend pago e domínio de envio verificado (T8).
- [ ] Decisão sobre o mapa (T9).
- **Saída:** `release/**` publica produção com smoke tests verdes.

### Fase 4 — Prova de carga antes do lançamento (exige autorização do PO)
Na homologação, com o banco **temporariamente** no mesmo plano da produção (algumas horas de M10 custam poucos
dólares), usando `perf/` e geradores de carga em **mais de uma máquina/IP** (um IP só mede o rate limit, não o sistema):

| Cenário | Objetivo | Carga | Aborta se |
|---|---|---|---|
| baseline | Conectividade e métricas | 10 usuários, 5 min | erro > 1% |
| capacidade | Req/s por instância (§4.3) | `max-instances=1`, rampa até p95 > 300 ms | erro > 2% ou p95 > 1 s |
| carga P3 | Regime de P3 | ~135 req/s por 30 min | erro > 1% ou op/s no Atlas > 80% do plano |
| carga P4 | Regime de P4 | ~360 req/s por 30 min | idem |
| pico P5 | Rajada de evento | 0 → 6.000 req/s em 5 min, 80% leitura pública | 5xx > 2% na origem |
| resistência | Vazamento e jobs | regime P2 por 4 h | heap crescendo sem parar |

Metas: RNF-02 (p95 ≤ 300 ms, login fora do orçamento conforme §2.1 do relatório de 23/09), erro ≤ 1%.
- **Saída:** relatório em `11-desempenho/` com o número real de req/s por instância, que substitui a hipótese de §4.3 e recalcula §5.

### Fase 5 — Operação
- [ ] Runbook de evento: antes de campanha ou crise anunciada, subir `min-instances` e o plano do Atlas; depois, voltar.
- [ ] Revisão mensal: DAU real × premissas da §4, ajustar patamar.

### Rollback por fase
- **Fase 1:** cada mudança é um PR revertível; o seed volta ao startup com `--max-instances=1`.
- **Fase 2:** DNS do domínio aponta direto para o Cloud Run (sem borda) enquanto se corrige a borda.
- **Fase 3:** a revisão anterior do Cloud Run fica disponível (`gcloud run services update-traffic --to-revisions=<anterior>=100`); o Atlas desce de plano pelo console.

---

## 8. Decisões do PO

| # | Decisão | Recomendação |
|---|---|---|
| D1 | As premissas da §4 (10% de DAU, 15% na hora de pico) estão razoáveis para o Radar Saúde? | Começar com elas e recalibrar com o DAU real após o beta |
| D2 | Cloudflare Free ou borda 100% GCP? | Cloudflare Free (US$ 0 e cache sem custo de tráfego), se a prova de conceito da Fase 2 fechar |
| D3 | Mapa: manter Mapbox ou voltar a MapLibre com tiles próprios? | Decidir antes de P2; com Mapbox, colocar teto de gasto na conta |
| D4 | `min-instances=1` em produção (fecha a pendência do cold start do ADR-011, E8-01) | Sim, ~US$ 15–70/mês |
| D5 | Autorizar a prova de carga da Fase 4 na homologação | Sim, com os critérios de abortar da tabela |

---

## 9. Fontes de preço consultadas

- MongoDB Atlas Flex (US$ 8 a 30/mês, até 500 op/s): https://www.mongodb.com/docs/atlas/billing/atlas-flex-costs/
- MongoDB Atlas, preço por região (exemplo do M30 em São Paulo): https://www.mongodb.com/docs/atlas/billing/invoice-breakdown/
- Cloud Run (regiões Tier 1 e Tier 2, cobrança por requisição e por instância): https://cloud.google.com/run/pricing
- Mapbox Maps SDK (cobrança por MAU): https://docs.mapbox.com/android/maps/guides/pricing/
- Resend: https://resend.com/pricing
