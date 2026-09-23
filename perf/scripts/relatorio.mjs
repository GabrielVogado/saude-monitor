// Gera o relatório de análise de um cenário de desempenho, cruzando:
//   - o lado do usuário: resumo exportado pelo k6 (summary.json);
//   - o lado do servidor: métricas do backend na janela do teste, consultadas no Prometheus;
//   - o consumo dos limites gratuitos (Atlas M0 e Cloud Run).
//
// node scripts/relatorio.mjs --saida <dir> --cenario <nome> --inicio <epoch> --fim <epoch> [--status-k6 N]
//
// Sem dependências: Node 18+ (fetch nativo).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []),
);
const SAIDA = args.saida;
const INICIO = Number(args.inicio);
const FIM = Number(args.fim);
const DURACAO = Math.max(60, FIM - INICIO);
const PROM = process.env.PROMETHEUS_LOCAL || 'http://127.0.0.1:9090';
const JOB = 'job="backend-hom"';

// Metas (RNF-02 e padrão da skill de performance) e limites gratuitos.
const META_P95_MS = 300;
const META_ERRO = 0.01;
const ATLAS_OPS_MAX = 100;
const CLOUD_RUN_REQ_MES = 2_000_000;

// ---------------------------------------------------------------- Prometheus

async function consulta(expr, instante = FIM + 60) {
  const url = `${PROM}/api/v1/query?query=${encodeURIComponent(expr)}&time=${instante}`;
  try {
    const r = await fetch(url);
    const corpo = await r.json();
    return corpo.status === 'success' ? corpo.data.result : [];
  } catch {
    return [];
  }
}
const escalar = async (expr) => {
  const r = await consulta(expr);
  return r.length ? Number(r[0].value[1]) : null;
};
const janela = `${DURACAO + 60}s`;

// Totais pela DIFERENÇA dos contadores entre o início e o fim, e não por increase(): uma
// série que nasce no meio da janela (primeira chamada a uma rota) perde o primeiro valor no
// increase() — no baseline isso contou 15 requisições onde houve 28. Série ausente no
// início = 0. Premissa: a instância não reiniciou no meio (ver Limitações).
async function porRotulo(expr, rotulo) {
  const antes = new Map((await consulta(expr, INICIO - 5)).map((s) => [s.metric[rotulo] ?? '', Number(s.value[1])]));
  const depois = await consulta(expr, FIM + 60);
  return depois.map((s) => ({ chave: s.metric[rotulo] ?? '', total: Math.max(0, Number(s.value[1]) - (antes.get(s.metric[rotulo] ?? '') ?? 0)) }));
}
async function diferenca(expr) {
  const linhas = await porRotulo(`sum(${expr})`, '__nada__');
  return linhas.length ? linhas[0].total : 0;
}

const servidor = {
  janela: { inicio: new Date(INICIO * 1000).toISOString(), fim: new Date(FIM * 1000).toISOString(), segundos: DURACAO },
  mongoOpsPico: await escalar(`max_over_time(sum(rate(mongodb_driver_commands_seconds_count{${JOB}}[1m]))[${janela}:10s])`),
  mongoOpsMedia: await escalar(`avg_over_time(sum(rate(mongodb_driver_commands_seconds_count{${JOB}}[1m]))[${janela}:10s])`),
  mongoComandos: await diferenca(`mongodb_driver_commands_seconds_count{${JOB}}`),
  mongoConexoesPico: await escalar(`max_over_time(sum(mongodb_driver_pool_checkedout{${JOB}})[${janela}:10s])`),
  backendRequisicoes: await diferenca(`http_server_requests_seconds_count{${JOB}, uri!~"/actuator.*"}`),
  backend5xx: await diferenca(`http_server_requests_seconds_count{${JOB}, status=~"5.."}`),
  // -1 = o Cloud Run não expõe a CPU dentro do contêiner; vira "indisponível" no relatório.
  cpuPico: await escalar(`max_over_time(max(process_cpu_usage{${JOB}})[${janela}:10s])`),
  heapPico: await escalar(`max_over_time((sum(jvm_memory_used_bytes{${JOB}, area="heap"}) / sum(jvm_memory_max_bytes{${JOB}, area="heap"}))[${janela}:10s])`),
  p95PorRota: (await consulta(
    `histogram_quantile(0.95, sum by (le, method, uri) (increase(http_server_requests_seconds_bucket{${JOB}, uri!~"/actuator.*"}[${janela}])))`,
  )).map((s) => ({ rota: `${s.metric.method} ${s.metric.uri}`, p95ms: Math.round(Number(s.value[1]) * 1000) }))
    .filter((s) => Number.isFinite(s.p95ms))
    .sort((a, b) => b.p95ms - a.p95ms),
  mongoPorComando: (await porRotulo(`sum by (command) (mongodb_driver_commands_seconds_count{${JOB}})`, 'command'))
    .map((s) => ({ comando: s.chave, total: Math.round(s.total) }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total),
};
writeFileSync(join(SAIDA, 'servidor.json'), JSON.stringify(servidor, null, 2));

// ---------------------------------------------------------------- k6

const caminhoResumo = join(SAIDA, 'summary.json');
const resumo = existsSync(caminhoResumo) ? JSON.parse(readFileSync(caminhoResumo, 'utf8')) : { metrics: {} };
const m = resumo.metrics || {};
const duracaoJornada = m['http_req_duration{scenario:jornada}'] || m.http_req_duration || {};
const falhas = m['http_req_failed{scenario:jornada}'] || m.http_req_failed || {};
const taxaErro = falhas.value ?? (falhas.passes != null ? falhas.passes / Math.max(1, falhas.passes + falhas.fails) : null);
const checks = m['checks{scenario:jornada}'] || m.checks || {};
const reqsTotal = m.http_reqs?.count ?? null;

const fluxos = Object.entries(m)
  .filter(([k]) => /^http_req_duration\{name:/.test(k))
  .map(([k, v]) => ({ fluxo: k.slice('http_req_duration{name:'.length, -1), ...v }))
  .sort((a, b) => (b['p(95)'] ?? 0) - (a['p(95)'] ?? 0));

// ---------------------------------------------------------------- relatório

const ms = (v) => (v == null ? '—' : `${Math.round(v)} ms`);
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`);
const n = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }));
const ok = (cond) => (cond == null ? '—' : cond ? '✅' : '❌');
const p95 = duracaoJornada['p(95)'];

const status = Number(args['status-k6'] ?? -1);
const desfecho = { 0: 'concluído — todas as metas atendidas', 99: 'concluído — alguma meta REPROVADA',
  108: 'ABORTADO por condição de parada (vigia do Mongo ou limiar de segurança)' }[status]
  ?? `código ${status}`;

const linhas = [];
const L = (s = '') => linhas.push(s);

L(`# Relatório de desempenho — ${args.cenario} (homologação)`);
L();
L(`- **Janela:** ${servidor.janela.inicio} → ${servidor.janela.fim} (${n(DURACAO)} s)`);
L(`- **Alvo:** backend de homologação (Cloud Run \`saude-monitor-backend-hom\`, 1 instância, 1 vCPU) + MongoDB Atlas M0`);
L(`- **Execução k6:** ${desfecho}`);
L();
L('## Resumo (metas)');
L();
L('| Indicador | Medido | Meta | |');
L('|---|---|---|---|');
L(`| Latência p95 da jornada (usuário) | ${ms(p95)} | ≤ ${META_P95_MS} ms (RNF-02) | ${ok(p95 == null ? null : p95 <= META_P95_MS)} |`);
L(`| Taxa de erro | ${pct(taxaErro)} | ≤ ${pct(META_ERRO)} | ${ok(taxaErro == null ? null : taxaErro <= META_ERRO)} |`);
L(`| Verificações aprovadas | ${pct(checks.value)} | ≥ 99% | ${ok(checks.value == null ? null : checks.value >= 0.99)} |`);
L(`| Pico de operações no Mongo | ${n(servidor.mongoOpsPico, 1)} op/s | < ${ATLAS_OPS_MAX} (Atlas M0) | ${ok(servidor.mongoOpsPico == null ? null : servidor.mongoOpsPico < ATLAS_OPS_MAX)} |`);
L(`| Erros 5xx no servidor | ${n(servidor.backend5xx)} | 0 | ${ok(servidor.backend5xx == null ? null : servidor.backend5xx < 1)} |`);
L();
L('## Lado do usuário — por fluxo (k6)');
L();
L('| Fluxo | p50 | p90 | p95 | p99 | máx | meta p95 |');
L('|---|---|---|---|---|---|---|');
for (const f of fluxos) {
  L(`| ${f.fluxo} | ${ms(f.med)} | ${ms(f['p(90)'])} | ${ms(f['p(95)'])} | ${ms(f['p(99)'])} | ${ms(f.max)} | ${ok(f['p(95)'] <= META_P95_MS)} |`);
}
L();
L(`Requisições enviadas pelo k6: **${n(reqsTotal)}** (inclui o vigia, que consulta o Prometheus local).`);
L();
L('## Lado do servidor — por rota (Prometheus)');
L();
L('| Rota | p95 no servidor |');
L('|---|---|');
for (const r of servidor.p95PorRota) L(`| \`${r.rota}\` | ${r.p95ms} ms |`);
L();
L(`- CPU do processo (pico): **${servidor.cpuPico == null || servidor.cpuPico < 0 ? 'indisponível (o Cloud Run não expõe ao contêiner)' : pct(servidor.cpuPico)}** · heap (pico): **${pct(servidor.heapPico)}**`);
L(`- Diferença entre p95 do usuário e do servidor ≈ rede (sua conexão ↔ São Paulo) + fila no Cloud Run.`);
L();
L('## Banco (MongoDB Atlas M0)');
L();
const jornadasOk = (m['checks{scenario:jornada}']?.passes ?? 0) > 0 ? Math.round(resumo.metrics.iterations?.count ?? 0) - 1 : null;
L(`- Operações na janela: **${n(servidor.mongoComandos)}**${jornadasOk > 0 ? ` (≈ ${n(servidor.mongoComandos / jornadasOk, 1)} por jornada)` : ''} · média **${n(servidor.mongoOpsMedia, 1)} op/s** · pico **${n(servidor.mongoOpsPico, 1)} op/s** (teto 100)`);
L(`- Conexões em uso (pico): **${n(servidor.mongoConexoesPico)}** (teto 500)`);
if (servidor.mongoPorComando.length) {
  L();
  L('| Comando | Quantidade |');
  L('|---|---|');
  for (const c of servidor.mongoPorComando) L(`| ${c.comando} | ${n(c.total)} |`);
}
L();
L('## Consumo dos limites gratuitos');
L();
L(`| Recurso | Consumido nesta execução | Limite gratuito |`);
L('|---|---|---|');
L(`| Requisições ao Cloud Run (API) | ${n(servidor.backendRequisicoes)} | 2.000.000 / mês (${pct(servidor.backendRequisicoes == null ? null : servidor.backendRequisicoes / CLOUD_RUN_REQ_MES)} da cota) |`);
L(`| Operações no Atlas (pico) | ${n(servidor.mongoOpsPico, 1)} op/s | 100 op/s |`);
L(`| E-mails (Resend) | 0 — cadastro e "esqueci a senha" fora da carga | 100 / dia |`);
L();
L('## Limitações');
L();
L('- As métricas do servidor são da instância em execução: um cold start durante o teste zera os contadores.');
L('- O teste sai de uma única máquina: a latência inclui a rede dela até São Paulo.');
L('- Heap, CPU e p95 por rota são da aplicação; o Atlas M0 não expõe métricas de servidor no plano gratuito.');

writeFileSync(join(SAIDA, 'relatorio.md'), linhas.join('\n') + '\n');
console.log(`relatorio.md e servidor.json gravados em ${SAIDA}`);
