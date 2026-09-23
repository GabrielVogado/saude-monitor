# Relatório de desempenho — carga100 (homologação)

- **Janela:** 2026-09-23T06:24:06.000Z → 2026-09-23T06:26:48.000Z (162 s)
- **Alvo:** backend de homologação (Cloud Run `saude-monitor-backend-hom`, 1 instância, 1 vCPU) + MongoDB Atlas M0
- **Execução k6:** concluído — alguma meta REPROVADA

## Resumo (metas)

| Indicador | Medido | Meta | |
|---|---|---|---|
| Latência p95 da jornada (usuário) | 157 ms | ≤ 300 ms (RNF-02) | ✅ |
| Taxa de erro | 0.00% | ≤ 1.00% | ✅ |
| Verificações aprovadas | 100.00% | ≥ 99% | ✅ |
| Pico de operações no Mongo | 39 op/s | < 100 (Atlas M0) | ✅ |
| Erros 5xx no servidor | 0 | 0 | ✅ |

## Lado do usuário — por fluxo (k6)

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

## Lado do servidor — por rota (Prometheus)

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

## Banco (MongoDB Atlas M0)

- Operações na janela: **4.135** (≈ 41,4 por jornada) · média **18,4 op/s** · pico **39 op/s** (teto 100)
- Conexões em uso (pico): **2** (teto 500)

| Comando | Quantidade |
|---|---|
| find | 3.230 |
| update | 300 |
| getMore | 205 |
| aggregate | 200 |
| insert | 200 |

## Consumo dos limites gratuitos

| Recurso | Consumido nesta execução | Limite gratuito |
|---|---|---|
| Requisições ao Cloud Run (API) | 1.205 | 2.000.000 / mês (0.06% da cota) |
| Operações no Atlas (pico) | 39 op/s | 100 op/s |
| E-mails (Resend) | 0 — cadastro e "esqueci a senha" fora da carga | 100 / dia |

## Limitações

- As métricas do servidor são da instância em execução: um cold start durante o teste zera os contadores.
- O teste sai de uma única máquina: a latência inclui a rede dela até São Paulo.
- Heap, CPU e p95 por rota são da aplicação; o Atlas M0 não expõe métricas de servidor no plano gratuito.
