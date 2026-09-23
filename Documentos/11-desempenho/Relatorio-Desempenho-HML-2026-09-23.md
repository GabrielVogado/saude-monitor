# Relatório de Desempenho — Homologação · 100 usuários (23/09/2026)

> **Versão:** 1.0 · **Ambiente:** homologação `v1.0.0-rc.3` (Cloud Run `saude-monitor-backend-hom`,
> 1 instância, 1 vCPU, 1 GiB + MongoDB Atlas M0) · **Ferramentas:** k6 + Prometheus + Grafana
> (`perf/`) e a skill `performance-testing-skill` · **Execução:** autorizada pelo PO.

## 1. Resumo executivo

100 usuários simultâneos percorreram a jornada completa do app **uma vez cada** — login,
lista de hospitais, filtro por raio, detalhe, **check-in, heartbeat, checkout, feedback**,
histórico e ranking. "Esqueci minha senha" e o cadastro ficaram fora da carga (enviam
e-mail; cota do Resend).

| Resultado | Valor |
|---|---|
| Requisições da jornada | 1.200, **0 erros**, 1.200/1.200 verificações aprovadas |
| p95 da jornada (visto pelo usuário) | **157 ms** — meta RNF-02: ≤ 300 ms ✅ |
| Fluxos dentro da meta | **11 de 12** |
| Fluxo reprovado | **login: p95 310 ms** (servidor: 263 ms) ❌ |
| Pico no MongoDB | **39 op/s** — teto do Atlas M0: 100 (39%) |
| Erros 5xx | 0 |
| Consumo do Cloud Run | 1.205 requisições (0,06% da cota mensal) |
| E-mails enviados | 0 |

**Conclusão:** com 100 usuários, o sistema atende ao RNF-02 em todos os fluxos, exceto o
**login**, que fica ~10 ms acima da meta no p95. O banco gratuito trabalhou com ~60% de
folga. Nenhum limite gratuito foi ameaçado.

## 2. Análise

### 2.1 Login é o único gargalo — e ele é esperado

O login é o fluxo mais caro por desenho: a senha é conferida com **BCrypt**
(`new BCryptPasswordEncoder()`, custo padrão 10), um algoritmo **propositalmente lento**
para dificultar força bruta. Numa instância de **1 vCPU**, logins que chegam juntos entram
em fila na CPU — por isso o p95 do servidor (263 ms) está bem acima dos demais endpoints
(≤ 111 ms) e a cauda do usuário chega a 374 ms.

**Não é defeito**, é custo de segurança. Opções, em ordem de preferência:

1. **Aceitar e documentar** que o login fica fora do orçamento de 300 ms (é uma chamada
   por sessão, não por tela; o token dura 15 min e o refresh 30 dias).
2. Subir a instância para 2 vCPU só na hora de pico (custo).
3. **Não** recomendado: reduzir o custo do BCrypt — enfraquece a proteção das senhas.

### 2.2 Banco com folga, mas o `find` domina

4.135 operações para 100 jornadas (**≈ 41 por jornada**; o baseline estimou 61 porque
inclui a leitura do catálogo no `setup`). **78% são `find`** (3.230). O pico de 39 op/s
indica que o M0 comporta essa carga, mas **não 3×** ela: ~250 usuários simultâneos com o
mesmo ritmo encostariam no teto de 100 op/s. É o primeiro limite a estourar se o uso crescer.

### 2.3 Cloud Run

Heap no pico: 28% — memória sobrando. O uso de CPU **não é exposto** ao contêiner no Cloud
Run (`process_cpu_usage = -1`), então a saturação da CPU no login é **inferida** pela
diferença de latência, não medida. Para medi-la: métricas do próprio Cloud Run no console
("Utilização de CPU do contêiner").

### 2.4 Rede

A diferença entre o p95 do usuário e o do servidor (~50 ms no login, ~60 ms na lista) é a
rede da máquina de teste até São Paulo mais a fila de entrada do Cloud Run.

## 3. Escopo, premissas e limitações

- **Um único gerador de carga** (uma máquina, um IP) — por isso os limites de requisição da
  homologação foram elevados (M-018): 300 logins/min e 2000 req/min públicas.
- **Início espalhado em 120 s** e pausas de 1–8 s entre ações (pessoa real). Não é um teste
  de estresse: 100 usuários "sem pausa" estourariam o M0.
- Hospitais variados por usuário (sem cache artificial num único id).
- Dados de teste **removidos** após a execução (100 visitas, 100 feedbacks e os agregados
  que eles criaram) — nenhum hospital ficou com nota de teste.
- As métricas do servidor são da instância em execução; não houve cold start na janela.

## 4. Próximos passos sugeridos

1. Decidir o tratamento do login (§2.1) — decisão do PO.
2. Repetir o teste após mudanças que toquem login, lista ou visitas (baseline + carga100).
3. Se o uso real se aproximar de ~200 usuários simultâneos: medir de novo e avaliar sair do
   Atlas M0 (o teto de 100 op/s é o primeiro limite a estourar).

## Anexo — relatório gerado pela execução

## Relatório de desempenho — carga100 (homologação)

- **Janela:** 2026-09-23T06:24:06.000Z → 2026-09-23T06:26:48.000Z (162 s)
- **Alvo:** backend de homologação (Cloud Run `saude-monitor-backend-hom`, 1 instância, 1 vCPU) + MongoDB Atlas M0
- **Execução k6:** concluído — alguma meta REPROVADA

### Resumo (metas)

| Indicador | Medido | Meta | |
|---|---|---|---|
| Latência p95 da jornada (usuário) | 157 ms | ≤ 300 ms (RNF-02) | ✅ |
| Taxa de erro | 0.00% | ≤ 1.00% | ✅ |
| Verificações aprovadas | 100.00% | ≥ 99% | ✅ |
| Pico de operações no Mongo | 39 op/s | < 100 (Atlas M0) | ✅ |
| Erros 5xx no servidor | 0 | 0 | ✅ |

### Lado do usuário — por fluxo (k6)

| Fluxo | p50 | p90 | p95 | p99 | máx | meta p95 |
|---|---|---|---|---|---|---|
| login | 148 ms | 258 ms | 310 ms | 368 ms | 374 ms | ❌ |
| lista | 128 ms | 164 ms | 175 ms | 190 ms | 193 ms | ✅ |
| ranking | 89 ms | 105 ms | 116 ms | 144 ms | 186 ms | ✅ |
| checkout | 58 ms | 70 ms | 101 ms | 211 ms | 211 ms | ✅ |
| checkin | 62 ms | 78 ms | 100 ms | 233 ms | 251 ms | ✅ |
| heartbeat | 58 ms | 80 ms | 92 ms | 144 ms | 285 ms | ✅ |
| feedback | 61 ms | 76 ms | 89 ms | 164 ms | 254 ms | ✅ |
| historico_visitas | 52 ms | 65 ms | 75 ms | 126 ms | 197 ms | ✅ |
| indicadores | 44 ms | 57 ms | 70 ms | 84 ms | 99 ms | ✅ |
| raio | 53 ms | 66 ms | 68 ms | 79 ms | 204 ms | ✅ |
| historico_feedbacks | 48 ms | 60 ms | 66 ms | 97 ms | 295 ms | ✅ |
| detalhe | 45 ms | 56 ms | 64 ms | 146 ms | 244 ms | ✅ |

Requisições enviadas pelo k6: **1.236** (inclui o vigia, que consulta o Prometheus local).

### Lado do servidor — por rota (Prometheus)

| Rota | p95 no servidor |
|---|---|
| `POST /api/v1/auth/login` | 263 ms |
| `GET /api/v1/hospitais` | 111 ms |
| `GET /api/v1/hospitais/ranking` | 81 ms |
| `POST /api/v1/visitas/checkin` | 52 ms |
| `POST /api/v1/feedbacks` | 48 ms |
| `POST /api/v1/visitas/{id}/heartbeat` | 44 ms |
| `POST /api/v1/visitas/{id}/checkout` | 42 ms |
| `GET /api/v1/contas/visitas` | 42 ms |
| `GET /api/v1/hospitais/{id}/indicadores` | 34 ms |
| `GET /api/v1/contas/feedbacks` | 32 ms |
| `GET /api/v1/hospitais/{id}` | 28 ms |

- CPU do processo (pico): **indisponível (o Cloud Run não expõe ao contêiner)** · heap (pico): **27.93%**
- Diferença entre p95 do usuário e do servidor ≈ rede (sua conexão ↔ São Paulo) + fila no Cloud Run.

### Banco (MongoDB Atlas M0)

- Operações na janela: **4.135** (≈ 41,4 por jornada) · média **18,4 op/s** · pico **39 op/s** (teto 100)
- Conexões em uso (pico): **2** (teto 500)

| Comando | Quantidade |
|---|---|
| find | 3.230 |
| update | 300 |
| getMore | 205 |
| aggregate | 200 |
| insert | 200 |

### Consumo dos limites gratuitos

| Recurso | Consumido nesta execução | Limite gratuito |
|---|---|---|
| Requisições ao Cloud Run (API) | 1.205 | 2.000.000 / mês (0.06% da cota) |
| Operações no Atlas (pico) | 39 op/s | 100 op/s |
| E-mails (Resend) | 0 — cadastro e "esqueci a senha" fora da carga | 100 / dia |

### Limitações

- As métricas do servidor são da instância em execução: um cold start durante o teste zera os contadores.
- O teste sai de uma única máquina: a latência inclui a rede dela até São Paulo.
- Heap, CPU e p95 por rota são da aplicação; o Atlas M0 não expõe métricas de servidor no plano gratuito.
