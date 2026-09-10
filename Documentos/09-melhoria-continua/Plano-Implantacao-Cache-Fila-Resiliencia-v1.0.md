# Plano de Implantação — Cache, Fila e Arquitetura de Resiliência

| Campo | Valor |
|---|---|
| **Versão** | 1.0 |
| **Status** | 🟡 Proposta — aguardando início de implementação por fases |
| **Data** | 09/09/2026 |
| **Commit-base** | `develop@14e4e96` |
| **Autor** | Planejamento assistido (Claude Code), a pedido do Product Owner |
| **Escopo** | Backend (`D:\saude-monitor\backend`) — nenhuma mudança de frontend prevista |

> **Este é um documento de planejamento, não de execução.** Nenhuma linha de código foi alterada para produzi-lo. Cada fase abaixo virá a ser implementada, revisada e testada individualmente, com o próprio PO decidindo quando e por qual fase começar. Nada aqui deve ser lido como "já entregue" — ver `Historico-Melhorias.md` para o que de fato já está em produção.

---

## Sumário

1. [Visão Geral e Objetivo](#1-visão-geral-e-objetivo)
2. [Contexto e Motivação](#2-contexto-e-motivação)
3. [Diagnóstico Técnico](#3-diagnóstico-técnico-medido-não-impressão)
4. [Decisões Arquiteturais](#4-decisões-arquiteturais)
5. [Plano de Implementação por Fases](#5-plano-de-implementação-por-fases)
6. [Dependências entre Fases](#6-dependências-entre-fases)
7. [Riscos e Mitigações](#7-riscos-e-mitigações)
8. [Critérios de Aceite (Definition of Done)](#8-critérios-de-aceite-definition-of-done)
9. [Referências](#9-referências)

---

## 1. Visão Geral e Objetivo

O Product Owner solicitou duas frentes de trabalho combinadas:

1. **Reduzir chamadas ao banco de dados** (MongoDB Atlas) através de **cache** e de um **sistema de filas**, ou solução equivalente.
2. **Aplicar o que está descrito** em [`Arquitetura de Resiliência, Segurança e Evolução Contínua.md`](./Arquitetura%20de%20Resiliência,%20Segurança%20e%20Evolução%20Contínua.md) (o "documento de Resiliência" doravante): rate limiting com Redis, migrations versionadas de banco de dados, testes de carga automatizados, testes A/B via feature flags, e autenticação JWT com rotação de chaves (JWKS).

Este documento consolida as duas frentes num único plano coerente, porque elas se sobrepõem tecnicamente: a mesma infraestrutura de cache (Redis) resolve tanto "economizar leituras" quanto "rate limit distribuído" do documento de Resiliência, e a mesma decisão de "sistema de filas" resolve tanto "reduzir escritas síncronas" quanto um problema operacional já existente e documentado (os 4 jobs agendados do backend, que provavelmente não disparam de forma confiável no ambiente atual — ver §3.4).

O plano está organizado em **7 fases** (0 a 6), pensadas para serem implementadas e validadas **uma a uma**, na ordem de dependência descrita no §6 — não é um "big bang". As fases 0–2 não introduzem nenhuma peça de infraestrutura nova (apenas corrigem ineficiências já existentes no código e criam a disciplina de processo — migrations e feature flags — que sustenta o resto com segurança). As fases 3–5 introduzem, respectivamente, cache/rate-limit distribuído (Upstash Redis), fila (Google Cloud Tasks + Cloud Scheduler) e autenticação assimétrica com rotação de chaves (JWKS). A fase 6 valida tudo sob carga real com k6.

---

## 2. Contexto e Motivação

### 2.1 O que motivou este plano

O pedido do PO não partiu de um sintoma isolado, mas de uma preocupação estrutural: o backend hoje bate no MongoDB a cada leitura e a cada escrita, sem nenhuma camada intermediária, e isso já foi medido como um problema real. O documento `Consolidacao-Tecnica-e-Backlog-Pendente-v1.1.md` (§0.2, PERF-03) registra, contra o ambiente de produção da época:

> `GET /api/v1/hospitais?page=0&size=20` — TTFB medido de **1,9 a 4,9 segundos**, contra um orçamento (RNF-02) de **p95 < 300 ms**. Ou seja, **6× a 16× acima do orçamento**.

Isso não é um problema resolvido pela migração de hospedagem (Render → Google Cloud Run, ver §2.2 abaixo): a migração resolveu o *cold start* absurdo do plano gratuito do Render (109 segundos), mas **não resolve a latência por requisição quando a instância já está quente** — essa latência é do código e do banco, não da infraestrutura de hospedagem. O cache ataca exatamente essa parte.

### 2.2 Restrição central: onde o backend roda hoje

O backend (Spring Boot 4, Java 25) roda no **Google Cloud Run**, região `southamerica-east1` (São Paulo), configurado (conforme `.github/workflows/cd-backend-google.yml`) com:

```
--min-instances=0     # a instância pode DESLIGAR POR COMPLETO quando ociosa
--max-instances=1     # trava atual (ver §3.5) — não é limite de capacidade real
--memory=1Gi --cpu=1
--timeout=60s
```

Isso importa muito para o desenho da solução, por dois motivos:

1. **Nenhum processo em memória sobrevive entre requisições de forma garantida.** Um cache "local" (ex.: um `ConcurrentHashMap` ou uma biblioteca como Caffeine dentro da própria JVM) funcionaria enquanto a instância estiver viva, mas ela pode ser desligada e recriada em qualquer momento de ociosidade — o cache esvazia sem aviso, e (pior) qualquer *lock* ou contador em memória local não é compartilhado se um dia o `--max-instances` subir. **Por isso o cache precisa ser externo** (Redis, fora do processo).
2. **Um "worker" de fila em background dentro do backend não é confiável.** Threads que ficam esperando mensagens indefinidamente dependem de a instância continuar viva e com CPU não estrangulada entre requisições — e o Cloud Run, por padrão, estrangula CPU fora de uma requisição ativa (não há a flag `--no-cpu-throttling` configurada, conforme confirmado no workflow de deploy). **Isso é, muito provavelmente, a causa raiz de um problema operacional que já existe e não foi diagnosticado até hoje**: o backend tem 4 jobs `@Scheduled` que deveriam rodar a cada 15 minutos, e não há qualquer garantia de que estão disparando de forma confiável neste ambiente (ver §3.4). **Por isso a fila precisa ser baseada em invocação HTTP** (Google Cloud Tasks + Cloud Scheduler), que é o único modelo compatível com "só processa durante uma requisição".

Essas duas restrições eliminaram, ainda na fase de investigação, alternativas que seriam a escolha padrão em uma infraestrutura convencional (Redis rodando ao lado do app; RabbitMQ ou Redis Streams com um worker consumidor). A decisão tomada com o PO está detalhada no §4.

### 2.3 O que já estava decidido antes deste plano

Dois documentos do projeto já continham decisões arquiteturais relevantes, que este plano **não reabre**, apenas executa:

- **`Arvore-Tecnologica-v2.0.md` §3.3**: *"Redis para cache de agregados — ➕ ADICIONAR (Fase 1 tardia). `AGREGADO_HOSPITAL` materializado no MongoDB já resolve leitura pública; Redis evita recalcular em picos de leitura."* — a decisão de usar Redis para cache já existia, só faltava executá-la.
- **`Arvore-Tecnologica-v2.0.md` ADR-004 — "Sem Kafka no MVP"**: *"Monólito modular com eventos assíncronos simples (`@TransactionalEventListener`/job de agregação); Kafka fica para quando houver múltiplos consumidores ou volume alto."* — este plano mantém essa filosofia: a solução de fila escolhida (Cloud Tasks) é deliberadamente mais simples que um broker de mensagens dedicado, e não introduz Kafka, RabbitMQ nem qualquer peça de infraestrutura que exija operação contínua (ver §4.2).

---

## 3. Diagnóstico Técnico (medido, não impressão)

Esta seção segue a diretriz de "Zero-Trust State" do projeto: nenhuma afirmação abaixo é suposição — cada uma foi verificada lendo o código-fonte (arquivo:linha) ou medindo o ambiente real.

### 3.1 Leituras públicas — candidatas a cache

Nenhum cache existe hoje em nenhuma forma (`@Cacheable`, `CacheManager`, Caffeine, Redis — busca completa no código e no `build.gradle`, zero ocorrências). Todos os endpoints abaixo batem no Mongo em toda chamada:

| Endpoint | Onde (arquivo:linha) | Consulta(s) Mongo por chamada | Observação |
|---|---|---|---|
| `GET /hospitais` (sem filtro geográfico) | `HospitalController.java:58` → `HospitalServiceImpl.java:132,328` | `mongoTemplate.find` full scan de ativos+tipo (336) + `findByHospitalIdIn` (423) | Ignora paginação no lado do Mongo — traz tudo, pagina em memória |
| `GET /hospitais` (com raio) | idem, `:304` | `$nearSphere` (324) + `findByHospitalIdIn` | Parâmetros contínuos (lat/lon do GPS) tornam a chave de cache não-trivial — ver §5, Fase 3 |
| `GET /hospitais/{id}` | `HospitalServiceImpl.java:120` | `findById` (122) + `findByHospitalIdIn` (417) | — |
| `GET /hospitais/{id}/indicadores` | `AgregadoServiceImpl.java:144` | `existsById` (146) + `findByHospitalId` (149) | — |
| `GET /hospitais/ranking` | `HospitalServiceImpl.java:157` | **Full scan sempre** (165, ignora `page`/`size` no Mongo, ordena e pagina em memória) + `findByHospitalIdIn` (167, todos os ids de uma vez) | **Pior candidato hoje** — sempre traz a coleção inteira, independentemente do que foi pedido |
| `GET /hospitais/{id}/geofence` | `HospitalServiceImpl.java:126` | `findById` (128) | Geometria estática — muda raramente |

Escritas que precisam invalidar esse cache quando ele existir: `criar` (75), `atualizar` (101) e `alterarStatus` (216) em `HospitalServiceImpl.java`; e o recálculo de agregado (evento pós-feedback ou job periódico, ver §3.3).

### 3.2 Estado em memória local que trava escalar para mais de 1 instância

Mesmo que o objetivo imediato não seja subir `--max-instances`, o código atual já tem estado que **impediria** isso hoje, e a Fase 0 corrige a raiz do problema:

- **`RateLimitService.contadores`** (`config/ratelimit/RateLimitService.java:44`) — `ConcurrentHashMap` local, janela fixa de 1 minuto, **só por IP**, e — achado relevante — **não é aplicado a usuários autenticados** (comentário explícito no código, `RateLimitFilter.java:25-27`: *"Endpoints autenticados... não são limitados aqui"*). Com mais de uma instância, o limite efetivo por IP multiplicaria pelo número de instâncias. Hoje é inofensivo só porque `--max-instances=1`.
- **`SeedRunner.java:75-76`** — *check-then-act* clássico: `long existentes = hospitalRepository.count();` seguido de `if (existentes > 0 ...) return;`. O próprio workflow de deploy já documenta isso (`cd-backend-google.yml:130-135`) como **a razão real** de `--max-instances=1` ser 1 — não é falta de capacidade, é para evitar que duas instâncias, nascendo ao mesmo tempo contra uma coleção vazia, importem o catálogo de hospitais duas vezes. Há uma mitigação parcial (`DuplicateKeyException` capturada no `save`), mas a janela entre o `count()` e o primeiro `save()` ainda permite trabalho duplicado.
- **`AdminUserSeeder.java:41,66`** — mesmo padrão *check-then-act*, dano menor (um índice único de e-mail provavelmente protege o dado final, mas ainda duplica I/O).

### 3.3 Processamento assíncrono já existente (não é proposta — já está em produção)

Um achado importante da investigação: o documento `Arvore-Tecnologica-v2.0.md` menciona `@TransactionalEventListener` como uma *possibilidade* para eventos assíncronos simples — mas isso **já foi implementado**, não é apenas uma proposta:

- `FeedbackServiceImpl.java:84,123` publica `FeedbackSalvoEvent(hospitalId)` após salvar/atualizar um feedback.
- `FeedbackSalvoEventListener.java:28` consome esse evento com `@Async @TransactionalEventListener(phase = AFTER_COMMIT, fallbackExecution = true)`, chamando `agregadoService.recalcular(hospitalId)`.
- **Limitação real**: não há `@Transactional` de fato no save do feedback (por isso `fallbackExecution=true` é necessário), e o `@Async` roda no `SimpleAsyncTaskExecutor` padrão do Spring — **sem pool, sem fila, sem controle de concorrência**, uma thread nova a cada execução. Esse processamento roda **na mesma instância/JVM** do request que o originou: não sobrevive a um crash ou reinício da instância, e não tem nenhum retry automático se falhar (o `catch` apenas loga e conta com o job de 15 minutos para cobrir a falha).

### 3.4 Os 4 jobs `@Scheduled` — o problema operacional que motivou a escolha de fila

Todos os 4 jobs de negócio do backend usam `fixedRate = 15 * 60 * 1000L` (15 minutos), configurados apenas via `@EnableScheduling` (pool padrão de 1 thread, sem `TaskScheduler` customizado):

| Job | Arquivo:linha | O que faz | Achado |
|---|---|---|---|
| `AgregadoHospitalJob` | `agregado/service/AgregadoHospitalJob.java:22` → `AgregadoServiceImpl.java:154-167` | Recalcula indicadores (nota média, tempo mediano) de hospitais | **Full scan reconhecido no próprio comentário do código**: recalcula **todos** os ~340 hospitais ativos a cada execução, mesmo que nada tenha mudado — cerca de **1.020 operações Mongo a cada 15 minutos**, sempre. Existe um método já escrito para versão incremental (`AgregadoHospitalRepository.findByIdInAndAtualizadoEmAfter`, linha 27) que **não é usado pelo job real** — e, pior, esse método tem um defeito: filtra por `_id` (identificador interno do Mongo), não por `hospitalId` (o campo que de fato identifica o hospital) — ou seja, mesmo se fosse chamado como o comentário sugere, **nunca encontraria nada**. A correção da Fase 0 precisa de um método novo e correto, não de "religar" o que já existe. |
| `VisitaExpiracaoJob` | `visita/service/VisitaExpiracaoJob.java:18` | Marca visitas sem heartbeat como `SUSPEITA`/`EXPIRADA` | Incremental (filtro por tempo já aplicado no Mongo), mas sem índice composto dedicado — usa índices simples e filtra parte em memória |
| `VisitaGpsInterrompidoJob` | `visita/service/VisitaGpsInterrompidoJob.java:18` → `VisitaServiceImpl.java:251-268` | Detecta visitas com GPS interrompido | **Full scan da subcoleção ativa**: busca **todas** as visitas com status `EM_ATENDIMENTO`, sem filtro de tempo no Mongo, e só filtra em Java depois — traz para a JVM todo documento ativo, mesmo os que sinalizaram há poucos segundos |
| `FeedbackSemRespostaJob` | `feedback/service/FeedbackSemRespostaJob.java:19` → `FeedbackServiceImpl.java:138-151` | Sinaliza visitas finalizadas sem feedback em 24h | **N+1**: chama `existsByVisitaId` **dentro de um loop**, uma consulta extra por visita candidata |

**O problema que une os quatro**: com `--min-instances=0`, o Cloud Run pode desligar a instância inteiramente durante um período ocioso — e, quando não há instância viva, **não há `@Scheduled` disparando absolutamente nada**, full scan ou não. O sintoma seria silencioso: indicadores públicos desatualizados, visitas nunca marcadas como expiradas, feedback nunca sinalizado como pendente — nada disso gera erro visível, só dados estagnados. Isso nunca foi formalmente investigado como incidente, mas a configuração atual do serviço é consistente com esse risco. A Fase 4 deste plano resolve isso ao mesmo tempo em que resolve o pedido de "sistema de filas": substituindo `@Scheduled` por Cloud Scheduler (que invoca o backend via HTTP, e portanto **acorda** a instância mesmo que ela esteja desligada).

### 3.5 Fluxo de escrita de visitas — o candidato a redesenho, não a fila

O endpoint de maior volume potencial é o `heartbeat` (chamado periodicamente enquanto uma visita está ativa). Hoje (`VisitaServiceImpl.java:164-180`), cada chamada faz **1 leitura + 1 escrita completa do documento**, incluindo **reescrever a lista `pontosAmostrais` inteira** a cada chamada (`visita.getPontosAmostrais().add(...)` seguido de `save()` do documento todo) — o documento cresce a cada heartbeat, e o custo de gravação cresce com ele. Isso não é um problema que "fila" resolve bem: o app espera confirmação síncrona de que o check-in continua ativo, então mover para assíncrono adicionaria latência percebida sem necessidade. A Fase 4 propõe, em vez disso, mover os pontos amostrais para uma coleção separada de inserção simples (sem reescrever o documento pai) — resolvendo o crescimento do documento sem sacrificar a resposta síncrona.

Também vale registrar, para completude: um achado adicional da investigação, fora do pedido original do PO, é que `JwtAuthenticationFilter` executa uma consulta Mongo (`loadUserByUsername`) em **todo** request autenticado. É candidato natural a um cache de TTL curto quando a Fase 3 estiver em produção, mas fica marcado como **oportunidade opcional**, não escopo obrigatório deste plano (evitar ampliar o escopo além do que foi pedido).

---

## 4. Decisões Arquiteturais

As três decisões abaixo foram tomadas em conjunto com o PO e **não devem ser reabertas** sem uma nova justificativa de negócio/custo — cada alternativa descartada tem um motivo concreto registrado.

### 4.1 Cache: Upstash (Redis serverless), não Memorystore

| Opção | Por que foi aceita/rejeitada |
|---|---|
| **Upstash — ✅ Escolhida** | Redis gerenciado, conexão via TLS direto (`rediss://`), **sem exigir VPC Connector** no Cloud Run. Cobra por comando/requisição, com free tier generoso — compatível com um serviço que fica ocioso a maior parte do tempo (`--min-instances=0`). |
| Google Cloud Memorystore | Redis nativo do GCP, mas exige **Serverless VPC Access Connector** (peça de infraestrutura extra) e tem **custo fixo mensal mesmo ocioso** (a partir de ~US$35/mês na menor instância) — pesado para um projeto que já perdeu a opção Oracle Always Free por esgotamento de capacidade e opera com orçamento restrito. |
| Cache local (Caffeine, em memória) | Zero custo e zero infraestrutura nova, mas **não sobrevive ao desligamento da instância** (§2.2) e não permite rate limiting distribuído nem qualquer futuro aumento de `--max-instances`. Descartado como solução definitiva, embora seja tecnicamente a opção "mais simples" — a simplicidade não compensa a fragilidade dado o modelo de hospedagem atual. |

### 4.2 Fila: Google Cloud Tasks + Cloud Scheduler, não Redis Streams nem broker dedicado

| Opção | Por que foi aceita/rejeitada |
|---|---|
| **Google Cloud Tasks + Cloud Scheduler — ✅ Escolhida** | Cada "mensagem" da fila é entregue como uma chamada HTTP ao próprio backend — modelo compatível com Cloud Run, que só processa durante uma requisição ativa. O Cloud Scheduler substitui os 4 jobs `@Scheduled` (resolvendo, de uma vez, o problema do §3.4) e o Cloud Tasks lida com retry/backoff nativamente, sem código de retry customizado. |
| Redis Streams (reaproveitando o Redis da Fase 3) | Evitaria pagar por um serviço novo, mas exige um **worker de longa duração** consumindo o stream — exatamente o padrão que o §2.2 já descartou por não ser confiável no Cloud Run atual. |
| Outbox pattern no MongoDB | Zero infraestrutura nova, e alinhado ao espírito do ADR-004 (evitar complexidade operacional) — mas tem o mesmo problema do worker em background, a menos que o consumo também seja disparado por Cloud Scheduler, o que o torna estruturalmente equivalente à opção escolhida, só que reinventando parte do que o Cloud Tasks já oferece de graça (retry, DLQ, taxa de entrega configurável). |
| Kafka / RabbitMQ (broker dedicado) | Rejeitado desde o ADR-004 do projeto (`Arvore-Tecnologica-v2.0.md`) por complexidade operacional desnecessária no volume atual do MVP. Este plano mantém essa decisão. |

### 4.3 JWT RS256 + JWKS + rotação de chaves entra neste mesmo plano

O documento de Resiliência pede explicitamente autenticação assimétrica com rotação de chaves. Hoje o backend usa HMAC simétrico (`JwtProperties.java`, chave única compartilhada). O PO decidiu tratar essa migração **dentro deste mesmo plano** (Fase 5), em vez de deixá-la para depois, para evitar reescrever a camada de autenticação duas vezes. É uma frente **independente** do cache/fila (pode ser feita em paralelo por outra pessoa, ver §6), incluída aqui só por conveniência de rastreamento num único documento.

### 4.4 Onde guardar segredos: Google Secret Manager para chaves de assinatura, Upstash só para dado operacional

O material de assinatura JWT (chave privada RSA) é um segredo crítico compartilhado por todas as instâncias — precisa de uma fonte única e auditada. O projeto já usa o Secret Manager para `MONGO_URI` e `JWT_SECRET` hoje; a Fase 5 segue o mesmo padrão, em vez de guardar chaves de assinatura no Redis (que é pensado para dado efêmero/operacional, não para segredo de longa duração).

---

## 5. Plano de Implementação por Fases

### Fase 0 — Otimizações sem infraestrutura nova

**Objetivo:** resolver as ineficiências mais gritantes encontradas no diagnóstico (§3.1, §3.4) usando apenas o que já existe (Mongo, índices, código), sem adicionar nenhuma peça nova. **Dependências:** nenhuma — pode começar imediatamente. **Por que vem primeiro:** é pré-requisito lógico para tudo depois — não faz sentido mover um job ineficiente para uma fila nova (Fase 4) sem primeiro corrigir a ineficiência em si; e corrigir a race de `SeedRunner`/`AdminUserSeeder` é o que eventualmente permitiria subir `--max-instances` no futuro, quando a Fase 4 introduzir mais concorrência via Cloud Scheduler/Tasks.

| Item | O que fazer | Onde |
|---|---|---|
| **0.1 — Fim do full scan de agregados** | Criar um método novo e correto (`findByHospitalIdInAndAtualizadoEmBefore`, filtrando por `hospitalId`, não por `_id` — ver a armadilha do §3.4). Descobrir os hospitais candidatos a recálculo consultando, por uma janela de tempo (`agora - 20min`, com margem sobre o ciclo de 15 min), quais tiveram feedback novo ou visita finalizada — via projeção `distinct("hospitalId")`, sem precisar de método derivado. Recalcular só esses, não os ~340. | `AgregadoServiceImpl.java`, `AgregadoHospitalRepository.java` |
| **0.2 — GPS interrompido filtra no Mongo** | Trocar a busca de todas as visitas ativas (depois filtradas em Java) por uma consulta que já filtra por tempo no Mongo — reusando um método que já existe e é usado por outro job (`findByStatusAndUltimoHeartbeatBefore`). Isso é seguro porque, na prática, `ultimoHeartbeat` já reflete o sinal de vida mais recente da visita (confirmado lendo o código do `heartbeat()`: os dois campos são sempre gravados com o mesmo instante). | `VisitaServiceImpl.java` |
| **0.3 — Fim do N+1 de feedback sem resposta** | Trocar a verificação "existe feedback?" repetida em loop por uma única consulta em lote (buscar todos os `visitaId` de uma vez, montar um conjunto em memória, filtrar). | `FeedbackServiceImpl.java`, `FeedbackRepository.java` |
| **0.4 — Índice composto `{status, ultimoHeartbeat}`** | Declarar o índice que falta em `VisitaDocument` — serve simultaneamente às três consultas acima. | `VisitaDocument.java` |
| **0.5 — Corrigir a race de inicialização** | Introduzir uma pequena coleção de "trava de seed" no Mongo: a primeira instância a conseguir inserir um documento de trava (operação atômica) é a única que executa o seed; qualquer instância concorrente encontra a trava já ocupada e desiste sem duplicar trabalho. Isso remove a causa raiz documentada de `--max-instances=1` ser uma trava de segurança, não de capacidade. | `SeedRunner.java`, `AdminUserSeeder.java` (novos: `SeedLockDocument`/`SeedLockRepository`) |

**Como verificar:** testes unitários confirmando o número exato de chamadas ao banco antes/depois (deve cair de ~340×3 para próximo de zero numa base sem atividade recente); inspeção do plano de execução no Mongo (`explain()`) confirmando uso do novo índice; teste de concorrência disparando o seed duas vezes ao mesmo tempo e confirmando que só uma execução de fato importa dados.

---

### Fase 1 — Migrations formais para MongoDB (Mongock)

**Objetivo:** atender o item "migrations" do documento de Resiliência, formalizando um processo versionado de mudança de schema/índices — hoje inexistente (índices só nascem de anotações Java, sem histórico nem garantia de execução única entre instâncias). **Dependências:** Fase 0 (evita escrever uma migration para um índice que ainda vai mudar de forma).

**Ferramenta escolhida: Mongock** — é o equivalente reconhecido a Flyway/Liquibase no ecossistema MongoDB + Spring Boot, com uma vantagem que interessa diretamente a este projeto: tem **lock distribuído nativo** (via uma coleção própria), a mesma classe de proteção que a Fase 0.5 teve que resolver manualmente para os seeds. Fica registrado como recomendação de acompanhamento (não bloqueante deste plano): uma vez que o Mongock esteja em produção, migrar `SeedRunner`/`AdminUserSeeder` para o mesmo mecanismo, aposentando a trava caseira da Fase 0.5.

**O que entra nesta fase:**
- Configuração do Mongock no projeto (dependência Gradle, pacote de changelogs versionados).
- Um primeiro changelog que **declara explicitamente** todos os índices que hoje só existem via anotação Java (compostos de visita, únicos de hospital/usuário/agregado, os dois índices geoespaciais `2dsphere`, o índice TTL da blacklist de refresh token) — sem recriar nada destrutivamente, apenas formalizando o que já existe.
- Um segundo changelog que registra formalmente o índice novo da Fase 0.4.
- Uma regra documentada de retrocompatibilidade para deploys sem downtime: nunca remover, no mesmo deploy, um campo que a revisão anterior ainda lê; qualquer índice `unique` novo passa primeiro por uma verificação de duplicatas antes de ser criado como restritivo.

**Como verificar:** ao iniciar a aplicação, os índices esperados devem aparecer na listagem do Mongo; rodar a aplicação duas vezes seguidas contra o mesmo banco não deve reexecutar changelogs já aplicados (idempotência).

---

### Fase 2 — Feature flags / infraestrutura de rollout gradual

**Objetivo:** atender o item "testes A/B via feature flags" do documento de Resiliência — e, tão importante quanto, criar a rede de segurança que permite ligar e desligar cada mudança de risco das Fases 3–5 **sem precisar de um novo deploy**, caso algo dê errado em produção. **Dependências:** Fase 1 (a coleção de flags nasce já sob o processo formal de migration).

**Abordagem escolhida:** uma solução própria e simples, guardada no MongoDB (flags com um percentual de tráfego e um interruptor ligado/desligado), lida periodicamente e mantida em memória local para não pesar em cada request. Bibliotecas de mercado (Unleash, Flagsmith) foram descartadas por serem operacionalmente pesadas demais para o porte e o orçamento do projeto — exigiriam manter mais um serviço rodando.

**Comportamento esperado:** cada flag pode estar totalmente desligada, totalmente ligada, ou ligada para uma fração do tráfego — nesse último caso, o mesmo usuário/dispositivo sempre cai do mesmo lado (não "pisca" entre versões a cada requisição), o que é o requisito mínimo para um teste A/B válido. Um endpoint administrativo permite ao time consultar e alterar as flags sem precisar de acesso direto ao banco.

**Flags previstas para as fases seguintes:** cache de hospitais, rate limit via Redis, fila de recálculo de agregados via Cloud Tasks, um interruptor de emergência para religar os jobs `@Scheduled` antigos caso o Cloud Scheduler falhe, e a migração para JWT assimétrico.

**Como verificar:** alternar uma flag manualmente e observar o efeito em produção em segundos, sem redeploy; confirmar que o mesmo usuário sempre recebe a mesma variante enquanto a flag estiver em rollout parcial.

---

### Fase 3 — Cache com Upstash Redis (+ rate limit distribuído)

**Objetivo:** atacar diretamente o pedido original — reduzir chamadas de leitura ao MongoDB — e, ao mesmo tempo, resolver a lacuna de rate limiting do documento de Resiliência (hoje só por IP, em memória local, sem cabeçalhos completos). **Dependências:** Fase 2 (toda chave de cache nasce atrás de uma flag). Pode ser feita em paralelo com a Fase 4.

**O que entra nesta fase:**
- Conexão TLS ao Upstash (sem exigir rede privada/VPC), com um limite de tempo de resposta curto e explícito — e, crucialmente, um comportamento de **falha segura**: se o Upstash cair ou demorar, o backend deve continuar respondendo normalmente a partir do MongoDB, só perdendo temporariamente o benefício do cache. Isso é uma decisão de resiliência deliberada: um serviço de cache externo nunca pode se tornar um novo ponto único de falha para o sistema.
- Uma chave e um tempo de expiração (TTL) pensados individualmente para cada um dos 6 pontos de leitura do §3.1 — o TTL de cada um é amarrado à frequência real com que aquele dado muda (por exemplo, os indicadores de um hospital nunca ficam mais desatualizados no cache do que já estão na fonte, porque o TTL escolhido é o mesmo ciclo do job de recálculo). Para a busca por raio geográfico, cuja entrada (latitude/longitude do GPS) varia ligeiramente a cada leitura, a chave de cache usa uma célula geográfica arredondada (de aproximadamente 1 km) em vez da coordenada exata — isso aumenta bastante a taxa de acerto do cache sem alterar de forma perceptível o resultado que o usuário recebe.
- Invalidação ativa: sempre que um administrador cria, edita ou desativa um hospital, ou quando o agregado de um hospital é recalculado, os dados em cache correspondentes são removidos imediatamente — o usuário nunca vê um dado cacheado mais antigo que a última mudança real.
- O rate limiting atual (só por IP, sem aplicar a usuários autenticados, sem cabeçalhos `Remaining`/`Reset`) é substituído por uma versão que vive no mesmo Redis, compartilhada entre instâncias, com identificação por usuário quando autenticado e por IP quando anônimo, e os três cabeçalhos padrão completos. Segue a mesma filosofia de falha segura do cache: se o Redis falhar, o rate limiter **libera** a requisição em vez de bloquear tráfego legítimo por um problema de infraestrutura que nada tem a ver com abuso.

**Como verificar:** confirmar, com instrumentação simples, que a segunda chamada a um mesmo endpoint dentro do TTL não gera nenhuma consulta ao MongoDB; confirmar que uma edição administrativa é refletida imediatamente na próxima leitura (sem esperar o TTL); simular o Upstash fora do ar e confirmar que os endpoints continuam respondendo; simular duas instâncias do backend compartilhando o mesmo Redis e confirmar que o limite de requisições é respeitado como se fosse uma instância só.

---

### Fase 4 — Fila com Google Cloud Tasks + Cloud Scheduler

**Objetivo:** atender a parte de "sistema de filas" do pedido original, e resolver de uma vez o problema operacional dos 4 jobs `@Scheduled` descrito no §3.4. **Dependências:** Fase 0 (não faz sentido migrar um job ainda ineficiente) e Fase 2 (flag de corte, permitindo reverter para o comportamento antigo em caso de problema). Pode ser feita em paralelo com a Fase 3.

**O que entra nesta fase:**
- Um segundo serviço no Cloud Run, sem acesso público, dedicado a receber as chamadas internas de job — evita ter que implementar e manter validação de token dentro da própria aplicação: a própria plataforma do Google já garante que só quem tem a permissão certa (uma identidade de serviço dedicada) consegue chamar esse serviço.
- Um pequeno conjunto de novos endpoints internos, um por job de negócio hoje agendado, cada um simplesmente chamando o método de serviço que já existe — não há nova lógica de negócio aqui, só uma nova porta de entrada.
- O agendamento em si passa a ser responsabilidade do Cloud Scheduler (fora do código da aplicação), que invoca esses endpoints a cada 15 minutos — e, por ser uma chamada HTTP externa, funciona mesmo que a instância esteja completamente desligada no momento agendado (o próprio Cloud Run a religa para atender a chamada). Os quatro `@Scheduled` atuais deixam de rodar por padrão, mas o mecanismo antigo fica disponível atrás de uma flag como rede de segurança durante a transição.
- O recálculo de agregado após um feedback (hoje resolvido de forma frágil, dentro da própria instância, sem sobreviver a um reinício — ver §3.3) passa a ser enfileirado como uma tarefa no Cloud Tasks, que garante a entrega (com novas tentativas automáticas em caso de falha) mesmo que a instância que recebeu o feedback original seja desligada antes de terminar o processamento.
- O heartbeat de visita **não** passa a usar fila — permanece uma operação síncrona, como hoje, porque o aplicativo espera a confirmação imediata de que o check-in continua ativo. O problema real ali (o documento da visita crescendo a cada heartbeat) é resolvido de outra forma: os pontos de localização passam a ser gravados numa coleção separada, um registro por heartbeat, em vez de reescrever a lista inteira dentro do documento principal a cada vez.

**Como verificar:** disparar manualmente um job pelo Cloud Scheduler e confirmar nos registros do sistema que ele executou; confirmar que uma chamada aos endpoints internos sem a identidade correta é rejeitada; medir o tamanho do documento de uma visita e o tempo de resposta do heartbeat antes e depois da mudança, confirmando que o crescimento linear desaparece.

---

### Fase 5 — JWT assimétrico (RS256) com JWKS e rotação de chaves

**Objetivo:** atender o item de autenticação do documento de Resiliência. **Dependências:** Fase 2 (um erro aqui afeta o login de todos os usuários — a flag permite reverter imediatamente). Independente das Fases 3 e 4 — pode ser feita por outra pessoa, em paralelo.

**O que entra nesta fase:**
- As chaves de assinatura passam a viver no Google Secret Manager (o mesmo lugar onde já vivem outros segredos do projeto hoje), não no Redis — por serem material de segurança crítico e compartilhado por todas as instâncias, e não um dado operacional efêmero.
- O backend passa a assinar tokens novos com uma chave assimétrica (uma privada para assinar, uma pública para verificar) em vez da chave simétrica única usada hoje. Cada chave recebe um identificador próprio, guardado dentro do próprio token, para que o backend saiba qual chave pública usar na verificação mesmo depois de uma rotação.
- **Transição sem impacto para o usuário**: tokens emitidos antes da mudança (no formato antigo) continuam sendo aceitos normalmente durante a janela de validade do refresh token (30 dias) — ninguém precisa fazer login de novo por causa da migração. Só os tokens novos, emitidos depois da mudança entrar em vigor, já vêm no formato novo.
- Um endereço público e padronizado (`/.well-known/jwks.json`) passa a expor as chaves públicas atuais — é o formato esperado por qualquer ferramenta ou consumidor externo que precise validar os tokens emitidos pelo sistema, hoje ou no futuro (por exemplo, o futuro Painel Administrativo Web).
- Fica documentado um processo simples e repetível para trocar as chaves periodicamente: gerar um par novo, marcá-lo como o ativo, manter o anterior disponível só para validação (não para emissão) até que nenhum token antigo possa mais existir, e então descartá-lo.

**Como verificar:** confirmar que um token emitido antes da migração continua autenticando normalmente durante a janela de transição; confirmar que um token novo já vem no formato assimétrico; confirmar que o endereço público de chaves responde com um formato válido e reconhecido por ferramentas padrão do mercado (ex.: decodificar um token em jwt.io usando a chave pública publicada e confirmar que a assinatura é válida).

---

### Fase 6 — Testes de carga (k6)

**Objetivo:** atender o item de testes de carga do documento de Resiliência, e — igualmente importante — **provar com números**, não apenas com teoria, que as Fases 3 e 4 realmente cumpriram o objetivo de reduzir a carga no banco e a latência percebida pelo usuário. **Dependências:** Fase 3 (cache e rate limit distribuído precisam existir para haver algo a medir). Os roteiros de teste podem começar a ser escritos em paralelo com as Fases 3/4, só não rodam contra o ambiente final antes disso.

**O que entra nesta fase:**
- Um roteiro de carga "normal", simulando o uso esperado do aplicativo de forma sustentada, para confirmar que o orçamento de latência (do RNF-02: 95% das respostas em menos de 300 milissegundos) passa a ser cumprido nos endpoints que ganharam cache — uma comparação direta de "antes" (medido em §2.1) e "depois".
- Um roteiro de "pico", simulando um evento de tráfego repentino (por exemplo, uma menção em rede social ou mídia), para confirmar que o rate limiting protege o sistema de forma controlada (devolvendo a resposta padrão de "muitas requisições") em vez de o sistema simplesmente parar de responder.
- Um roteiro de "resistência", com carga moderada por um período mais longo (1 a 2 horas), pensado para revelar problemas que só aparecem com o tempo (por exemplo, uma conexão que nunca é liberada).
- Uma forma de simular, mesmo em ambiente local, que o rate limiting funciona corretamente quando há mais de uma instância do backend rodando ao mesmo tempo — rodando dois processos locais apontando para o mesmo Redis e confirmando que o limite é respeitado como se fosse um só.
- Um critério de aprovação automático dentro do próprio roteiro de teste (não apenas um relatório para leitura humana): se o orçamento de latência não for cumprido, o teste falha sozinho — abrindo caminho para, no futuro, rodar isso a cada mudança relevante e não só manualmente.

**Como verificar:** comparar o resultado do roteiro "normal" antes e depois da Fase 3 entrar em produção — a melhora deve ser evidente e mensurável, não apenas percebida subjetivamente.

---

## 6. Dependências entre Fases

```
Fase 0 (otimizações) ──→ Fase 1 (Mongock) ──→ Fase 2 (feature flags) ──┬──→ Fase 3 (cache + rate limit) ──┐
                                                                          │                                    ├──→ Fase 6 (k6)
                                                                          ├──→ Fase 4 (Cloud Tasks/Scheduler) ─┤
                                                                          └──→ Fase 5 (JWT RS256/JWKS) ────────┘
```

**Leitura do diagrama:**
- As Fases 0, 1 e 2 são estritamente sequenciais — cada uma é pré-requisito de processo (não técnico obrigatório, exceto a Fase 0→3/4) para a seguinte.
- Uma vez concluída a Fase 2, as **Fases 3, 4 e 5 são totalmente independentes entre si** — podem ser conduzidas em paralelo, por pessoas diferentes, sem que uma bloqueie a outra.
- A Fase 6 é a última porque depende de haver algo concreto para medir (cache e fila em funcionamento) — mas a escrita dos roteiros de teste em si pode começar bem antes.

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação prevista no plano |
|---|---|---|---|
| Upstash fica indisponível ou lento | Baixa (é um serviço gerenciado com SLA), mas não nula | Médio se mal tratado | Fase 3 exige explicitamente falha segura: cache e rate limit nunca bloqueiam a requisição, só deixam de otimizá-la |
| Migração de JWT quebra sessões de usuários existentes | Baixa se a janela de compatibilidade for respeitada | Alto (usuários deslogados em massa) | Fase 5 mantém validação do formato antigo por 30 dias; emissão nova migra gradualmente atrás de flag |
| Cloud Scheduler/Tasks mal configurado deixa de disparar jobs críticos (ex.: expiração de visita) | Média, por ser infraestrutura nova | Alto (dado de negócio parado) | Fase 4 mantém o mecanismo antigo (`@Scheduled`) disponível atrás de uma flag de emergência durante a transição |
| Cache serve dado desatualizado após uma edição administrativa | Baixa (invalidação é ativa, não só por TTL) | Baixo (janela mínima entre escrita e invalidação) | Fase 3 inclui invalidação ativa em toda escrita relevante, não depende só do TTL |
| Escopo do plano cresce além do que o PO pediu (ex.: cache do `loadUserByUsername`, achado extra do §3.5) | Média — é tentador resolver tudo que se encontra | Baixo tecnicamente, alto em gestão de expectativa | Marcado explicitamente como fora de escopo neste documento; qualquer adição deve ser negociada com o PO antes de entrar em uma fase |

---

## 8. Critérios de Aceite (Definition of Done)

Seguindo o padrão já usado pelo documento de Resiliência original, este plano só pode ser considerado concluído quando:

- [ ] Os quatro jobs de negócio antes agendados via `@Scheduled` disparam de forma comprovadamente confiável via Cloud Scheduler, com evidência de execução recente sempre disponível.
- [ ] Os endpoints públicos de leitura de hospitais cumprem o orçamento de latência do RNF-02 (p95 < 300 ms) sob o roteiro de carga "normal" do k6.
- [ ] O rate limiting é aplicado tanto a requisições anônimas quanto autenticadas, com os três cabeçalhos padrão completos, e continua funcionando de forma consistente com mais de uma instância do backend simultaneamente.
- [ ] Toda mudança de risco (cache, fila, autenticação assimétrica) pode ser desligada em produção sem necessidade de um novo deploy.
- [ ] Toda alteração de índice ou schema do MongoDB, a partir deste plano, passa pelo processo formal de migration, com histórico rastreável.
- [ ] Um token emitido antes da migração de autenticação continua válido durante toda a janela de transição documentada.
- [ ] Os roteiros de carga do k6 estão versionados no repositório e podem ser executados a qualquer momento contra o ambiente de desenvolvimento.

---

## 9. Referências

- `Documentos/09-melhoria-continua/Arquitetura de Resiliência, Segurança e Evolução Contínua.md` — documento de origem do pedido de rate limit, migrations, testes de carga, feature flags e JWKS.
- `Documentos/08-analise tecnica/Consolidacao-Tecnica-e-Backlog-Pendente-v1.1.md` §0.2 (PERF-01..04) — medição original da latência que motivou este plano; §B.7 (OPS-02) — estado em memória local já identificado como risco de escalonamento.
- `Documentos/02-arquitetura-tecnica/Arvore-Tecnologica-v2.0.md` §3.3 e ADR-004 — decisões arquiteturais preexistentes sobre Redis e sobre rejeitar Kafka, mantidas por este plano.
- `.github/workflows/cd-backend-google.yml` — configuração atual de hospedagem no Google Cloud Run, incluindo o comentário que documenta a razão real de `--max-instances=1`.
- Código-fonte do backend (`backend/src/main/java/br/com/saude_monitor/api/`), citado por arquivo e linha ao longo do §3 — toda afirmação técnica deste documento foi verificada diretamente no código nesta data, não apenas em documentação anterior.
