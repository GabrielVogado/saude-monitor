# Relatório de desempenho — baseline (homologação)

- **Janela:** 2026-09-23T03:53:57.000Z → 2026-09-23T03:54:39.000Z (60 s)
- **Alvo:** backend de homologação (Cloud Run `saude-monitor-backend-hom`, 1 instância, 1 vCPU) + MongoDB Atlas M0
- **Execução k6:** concluído — todas as metas atendidas

## Resumo (metas)

| Indicador | Medido | Meta | |
|---|---|---|---|
| Latência p95 da jornada (usuário) | 126 ms | ≤ 300 ms (RNF-02) | ✅ |
| Taxa de erro | 0.00% | ≤ 1.00% | ✅ |
| Verificações aprovadas | 100.00% | ≥ 99% | ✅ |
| Pico de operações no Mongo | 2 op/s | < 100 (Atlas M0) | ✅ |
| Erros 5xx no servidor | 0 | 0 | ✅ |

## Lado do usuário — por fluxo (k6)

| Fluxo | p50 | p90 | p95 | p99 | máx | meta p95 |
|---|---|---|---|---|---|---|
| login | 143 ms | 154 ms | 155 ms | 156 ms | 156 ms | ✅ |
| lista | 109 ms | 109 ms | 109 ms | 109 ms | 109 ms | ✅ |
| ranking | 86 ms | 87 ms | 87 ms | 88 ms | 88 ms | ✅ |
| feedback | 67 ms | 71 ms | 72 ms | 72 ms | 72 ms | ✅ |
| checkout | 59 ms | 64 ms | 65 ms | 65 ms | 65 ms | ✅ |
| heartbeat | 60 ms | 63 ms | 63 ms | 64 ms | 64 ms | ✅ |
| checkin | 60 ms | 62 ms | 63 ms | 63 ms | 63 ms | ✅ |
| raio | 54 ms | 58 ms | 58 ms | 58 ms | 58 ms | ✅ |
| detalhe | 48 ms | 53 ms | 53 ms | 54 ms | 54 ms | ✅ |
| historico_visitas | 50 ms | 51 ms | 51 ms | 51 ms | 51 ms | ✅ |
| historico_feedbacks | 47 ms | 47 ms | 47 ms | 47 ms | 47 ms | ✅ |
| indicadores | 41 ms | 42 ms | 42 ms | 42 ms | 43 ms | ✅ |

Requisições enviadas pelo k6: **36** (inclui o vigia, que consulta o Prometheus local).

## Lado do servidor — por rota (Prometheus)

| Rota | p95 no servidor |
|---|---|
| `POST /api/v1/auth/login` | 132 ms |
| `GET /api/v1/hospitais` | 81 ms |
| `GET /api/v1/hospitais/ranking` | 61 ms |
| `POST /api/v1/feedbacks` | 44 ms |
| `POST /api/v1/visitas/checkin` | 34 ms |
| `POST /api/v1/visitas/{id}/checkout` | 29 ms |
| `POST /api/v1/visitas/{id}/heartbeat` | 28 ms |
| `GET /api/v1/hospitais/{id}` | 27 ms |
| `GET /api/v1/contas/visitas` | 23 ms |
| `GET /api/v1/contas/feedbacks` | 22 ms |
| `GET /api/v1/hospitais/{id}/indicadores` | 13 ms |

- CPU do processo (pico): **indisponível (o Cloud Run não expõe ao contêiner)** · heap (pico): **26.11%**
- Diferença entre p95 do usuário e do servidor ≈ rede (sua conexão ↔ São Paulo) + fila no Cloud Run.

## Banco (MongoDB Atlas M0)

- Operações na janela: **102** (≈ 51 por jornada) · média **0,9 op/s** · pico **2 op/s** (teto 100)
- Conexões em uso (pico): **0** (teto 500)

| Comando | Quantidade |
|---|---|
| find | 80 |
| getMore | 8 |
| update | 6 |
| aggregate | 4 |
| insert | 4 |

## Consumo dos limites gratuitos

| Recurso | Consumido nesta execução | Limite gratuito |
|---|---|---|
| Requisições ao Cloud Run (API) | 28 | 2.000.000 / mês (0.00% da cota) |
| Operações no Atlas (pico) | 2 op/s | 100 op/s |
| E-mails (Resend) | 0 — cadastro e "esqueci a senha" fora da carga | 100 / dia |

## Limitações

- As métricas do servidor são da instância em execução: um cold start durante o teste zera os contadores.
- O teste sai de uma única máquina: a latência inclui a rede dela até São Paulo.
- Heap, CPU e p95 por rota são da aplicação; o Atlas M0 não expõe métricas de servidor no plano gratuito.
