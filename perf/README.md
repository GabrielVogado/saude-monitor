# Testes de desempenho — homologação

Estrutura local para medir o desempenho do Radar Saúde **como um usuário final**, contra o
ambiente de **homologação** (Cloud Run `saude-monitor-backend-hom` + MongoDB Atlas M0),
com painel **ao vivo** e **relatório** de análise — sem sair dos limites gratuitos.

Tudo roda no Docker desta máquina: Prometheus, Grafana e k6 não custam nada. Só a jornada
de teste e a coleta de métricas chegam ao Google.

## O que é testado

Cada usuário virtual é um usuário de teste próprio (`perf-001` … `perf-100`) e percorre
**uma vez** a jornada do app:

`login → lista de hospitais → filtro por raio → detalhe + indicadores → check-in → heartbeat
→ checkout → feedback → histórico de visitas e feedbacks → ranking`

**Fora da carga:** "esqueci minha senha" e o cadastro. Os dois enviam e-mail pelo Resend
(cota gratuita de 100/dia); os usuários de teste são criados direto no banco.

| Cenário | Usuários | Para quê |
|---|---|---|
| `baseline` | 2 | Sempre primeiro: valida conexão, login e coleta; mede quantas operações de Mongo uma jornada custa |
| `carga100` | 100 simultâneos, início espalhado em 120 s, pausas de pessoa real | Carga de 100 usuários |

**Metas:** p95 ≤ 300 ms (RNF-02) e erros ≤ 1%, no geral e por fluxo.

## Limites gratuitos e condições de parada

| Recurso | Limite gratuito | Proteção |
|---|---|---|
| MongoDB Atlas M0 | **100 operações/s** (acima disso o Atlas estrangula o cluster — que é o mesmo do dev) | O cenário `vigia` lê as op/s no Prometheus e **aborta o teste** acima de 90 por 30 s |
| Cloud Run | 2 milhões de requisições/mês | `carga100` ≈ 1.500 requisições (0,08%) |
| Resend | 100 e-mails/dia | Nenhum e-mail no teste |

O k6 também aborta se a taxa de erro passar de **5%** ou o p95 passar de **5 s** por 30 s.

Medido no baseline de 23/09/2026: **≈ 61 operações de Mongo por jornada**. Com a rampa de
120 s, a carga de 100 usuários fica estimada em ~50 op/s de pico. Se a jornada mudar, rode
o baseline de novo antes da carga.

## Pré-requisitos

- Docker Desktop rodando; Git Bash; Node 18+.
- `gcloud` autenticado no projeto (a URI do banco vem do Secret Manager direto para o
  contêiner, sem aparecer na tela).
- Para `carga100`: homologação com os limites de requisição altos (PR #131). Com os limites
  de dev (10 logins/min por IP), 90 dos 100 logins seriam recusados com 429.

## Passo a passo

```bash
# 1. Uma vez: senhas locais (perf/.env, não versionado) + 100 usuários de carga e o ADMIN de coleta
bash perf/scripts/preparar.sh

# 2. Sempre primeiro
bash perf/scripts/executar.sh baseline

# 3. Carga — abra http://localhost:3000 antes, para assistir ao vivo
bash perf/scripts/executar.sh carga100

# 4. Ao terminar os testes do dia
bash perf/scripts/limpar.sh                        # remove visitas/feedbacks de teste
(cd perf && docker compose --env-file .env down)   # para a coleta (ela mantém o backend acordado)
```

## Acompanhar ao vivo

`http://localhost:3000` → painel **Radar Saúde — Desempenho (homologação)**, atualizado a
cada 5 s:

- **Limites gratuitos:** op/s no Mongo com as faixas de 80/100, conexões em uso, requisições.
- **Lado do usuário (k6):** usuários ativos, requisições/s, p95/p99 e erros por fluxo.
- **Backend:** requisições/s e p95 por rota, 5xx, tempo por comando do Mongo, heap.

Prometheus direto: `http://localhost:9090`. Os dois só escutam em `127.0.0.1`.

## Relatório

Cada execução grava em `perf/resultados/<data>-<cenário>/`:

| Arquivo | Conteúdo |
|---|---|
| `relatorio.md` | Análise: metas, fluxos (usuário), rotas (servidor), Mongo por comando, consumo dos limites gratuitos |
| `summary.json` | Resumo exportado pelo k6 |
| `servidor.json` | Métricas do backend na janela do teste |
| `normalizado.json`, `relatorio-skill.md` | Formato da skill `performance-testing-skill`, se instalada |
| `k6.log` | Saída completa, com as leituras do vigia |

## Como funciona

- `docker-compose.yml`: `token` faz login como o ADMIN de coleta a cada 10 min (o
  `/actuator/prometheus` exige papel ADMIN e o token vale 15 min); `prometheus` coleta o
  backend a cada 10 s e recebe as métricas do k6 por *remote write*; `grafana` já vem com o
  painel.
- `k6/jornada.js`: cenários, jornada e vigia.
- `mongo/`: criação e limpeza dos dados de teste (só no banco `saude_monitor_hom`; o script
  se recusa a rodar em outro).
- `config-desempenho.json`: a configuração no formato da skill de performance (validada
  com `validate-performance-config.js`).

## Limitações

- As métricas do servidor são da instância em execução: um cold start durante o teste zera
  os contadores.
- A latência medida pelo k6 inclui a rede desta máquina até São Paulo.
- O Cloud Run não expõe o uso de CPU dentro do contêiner (a métrica vem `-1`).
- O Atlas M0 não expõe métricas de servidor; o lado do banco é medido pelo driver.
