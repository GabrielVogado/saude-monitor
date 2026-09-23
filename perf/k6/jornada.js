// Jornada do usuário final do Radar Saúde contra a HOMOLOGAÇÃO.
//
// Cada usuário virtual é um usuário de teste próprio (perf-NNN, criado por
// mongo/criar-usuarios.js) e percorre UMA vez o que a pessoa faz no app:
//
//   login → lista de hospitais → filtro por raio → detalhe + indicadores
//   → check-in → heartbeat → checkout → feedback → histórico → ranking
//
// Fora da carga, por decisão do PO: "Esqueci minha senha" e o cadastro — os dois enviam
// e-mail pelo Resend (cota gratuita de 100/dia).
//
// Cenários (variável CENARIO):
//   baseline  2 usuários — valida conexão, autenticação e coleta, e mede quantas
//             operações de Mongo uma jornada custa, ANTES de qualquer carga.
//   carga100  100 usuários simultâneos, com início espalhado em RAMPA_S segundos e pausas
//             de pessoa real entre as ações.
//
// Proteção dos limites gratuitos: o cenário `vigia` lê do Prometheus as operações/s do
// Mongo e ABORTA o teste se passarem de MONGO_OPS_MAX (padrão 90; teto do Atlas M0 = 100)
// por 3 leituras seguidas (~30 s). Os limiares de erro e de latência abaixo também abortam.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import exec from 'k6/execution';

const API = __ENV.API_URL;
const SENHA = __ENV.PERF_SENHA;
const PROMETHEUS = __ENV.PROMETHEUS_URL || 'http://prometheus:9090';
const CENARIO = __ENV.CENARIO || 'baseline';
const MONGO_OPS_MAX = Number(__ENV.MONGO_OPS_MAX || 90);
// Identifica ESTA execucao nas metricas do Prometheus (o executar.sh passa o mesmo valor em
// --tag testid). Sem o filtro, o vigia somaria VUs que sobraram de uma execucao anterior.
const TESTID = __ENV.TESTID || '';

const CENARIOS = {
  baseline: { usuarios: 2, rampaS: 5 },
  carga100: { usuarios: 100, rampaS: Number(__ENV.RAMPA_S || 120) },
};
if (!CENARIOS[CENARIO]) {
  throw new Error(`CENARIO=${CENARIO} desconhecido; use ${Object.keys(CENARIOS).join(' ou ')}`);
}
const { usuarios, rampaS } = CENARIOS[CENARIO];

// Fluxos medidos individualmente (tag `name`). Cada um ganha limiar próprio, e por isso
// aparece separado no resumo exportado e no relatório.
const FLUXOS = ['login', 'lista', 'raio', 'detalhe', 'indicadores', 'checkin', 'heartbeat',
  'checkout', 'feedback', 'historico_visitas', 'historico_feedbacks', 'ranking'];

const limiaresPorFluxo = Object.fromEntries(
  FLUXOS.map((f) => [`http_req_duration{name:${f}}`, ['p(95)<300']]),
);

export const options = {
  scenarios: {
    jornada: {
      executor: 'per-vu-iterations',
      vus: usuarios,
      iterations: 1,
      maxDuration: '10m',
      exec: 'jornada',
    },
    vigia: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '11m',
      exec: 'vigia',
    },
  },
  thresholds: {
    // Metas (RNF-02 e taxa de erro): reprovam o teste, sem interromper.
    'http_req_duration{scenario:jornada}': [
      'p(95)<300',
      // Parada de segurança: p95 acima de 5 s por 30 s = sistema em colapso.
      { threshold: 'p(95)<5000', abortOnFail: true, delayAbortEval: '30s' },
    ],
    'http_req_failed{scenario:jornada}': [
      'rate<0.01',
      { threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' },
    ],
    'checks{scenario:jornada}': ['rate>0.99'],
    ...limiaresPorFluxo,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  // Os dados de teste não usam produção nem terceiros: nenhum e-mail, nenhum mapa.
  userAgent: 'radar-saude-perf/k6',
};

// ------------------------------------------------------------------ preparação

export function setup() {
  // Catálogo público, lido UMA vez e dividido entre os usuários: cada um escolhe hospitais
  // diferentes (dados variados, sem cache artificialmente quente num único id).
  const hospitais = [];
  for (let pagina = 0; pagina < 5; pagina++) {
    const r = http.get(`${API}/api/v1/hospitais?page=${pagina}&size=100`, { tags: { name: 'setup' } });
    if (r.status !== 200) {
      throw new Error(`setup: lista de hospitais respondeu ${r.status} — ambiente errado ou fora do ar?`);
    }
    const corpo = r.json();
    for (const h of corpo.content) {
      if (h.ativo && h.localizacao) hospitais.push({ id: h.id, lat: h.localizacao.latitude, lon: h.localizacao.longitude });
    }
    if (pagina + 1 >= corpo.totalPages) break;
  }
  if (hospitais.length === 0) throw new Error('setup: nenhum hospital ativo com localização');
  return { hospitais };
}

// ------------------------------------------------------------------ jornada

function pausa(min, max) {
  sleep(min + Math.random() * (max - min));
}

function json(corpo, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { headers };
}

export function jornada(dados) {
  // Numero do usuario pela iteracao DESTE cenario (0..N-1), nao pelo id do VU: o id e
  // global entre cenarios, e o vigia ocupa um deles -- uma jornada cairia em perf-101, que
  // nao existe (achado do code-review).
  const numero = exec.scenario.iterationInTest + 1;
  const n = String(numero).padStart(3, '0');
  const email = `perf-${n}@carga.radarsaude.test`;
  const hospital = dados.hospitais[(numero * 7) % dados.hospitais.length];
  const posicao = { type: 'Point', coordinates: [hospital.lon, hospital.lat] };

  // Início espalhado: 100 logins no mesmo segundo seriam ~300 operações de Mongo de uma vez,
  // acima do teto do M0. Espalhados em RAMPA_S, ficam bem abaixo.
  sleep(Math.random() * rampaS);

  let token;
  group('01 login', () => {
    const r = http.post(`${API}/api/v1/auth/login`, JSON.stringify({ email, password: SENHA, rememberDevice: false }),
      { ...json(), tags: { name: 'login' } });
    check(r, { 'login 200': (x) => x.status === 200 });
    token = r.status === 200 ? r.json('accessToken') : null;
  });
  if (!token) return;
  const auth = { Authorization: `Bearer ${token}` };
  pausa(2, 5);

  group('02 descobrir hospital', () => {
    check(http.get(`${API}/api/v1/hospitais?page=0&size=100`, { tags: { name: 'lista' } }),
      { 'lista 200': (x) => x.status === 200 });
    pausa(2, 4);
    check(http.get(`${API}/api/v1/hospitais?latitude=${hospital.lat}&longitude=${hospital.lon}&raioKm=5&page=0&size=20`,
      { tags: { name: 'raio' } }), { 'raio 200': (x) => x.status === 200 });
    pausa(1, 3);
    check(http.get(`${API}/api/v1/hospitais/${hospital.id}`, { tags: { name: 'detalhe' } }),
      { 'detalhe 200': (x) => x.status === 200 });
    check(http.get(`${API}/api/v1/hospitais/${hospital.id}/indicadores`, { tags: { name: 'indicadores' } }),
      { 'indicadores 200': (x) => x.status === 200 });
  });
  pausa(2, 4);

  let visitaId;
  group('03 visita', () => {
    const c = http.post(`${API}/api/v1/visitas/checkin`,
      JSON.stringify({ hospitalId: hospital.id, origem: 'MANUAL', dispositivoId: `perf-${n}` }),
      { ...json(null, token), tags: { name: 'checkin' } });
    check(c, { 'checkin 201/200': (x) => x.status === 201 || x.status === 200 });
    visitaId = (c.status === 201 || c.status === 200) ? c.json('id') : null;
    if (!visitaId) return;
    pausa(3, 6);

    check(http.post(`${API}/api/v1/visitas/${visitaId}/heartbeat`, JSON.stringify({ posicao }),
      { ...json(null, token), tags: { name: 'heartbeat' } }), { 'heartbeat 200': (x) => x.status === 200 });
    pausa(3, 6);

    check(http.post(`${API}/api/v1/visitas/${visitaId}/checkout`, JSON.stringify({ posicao, encerramentoManual: true }),
      { ...json(null, token), tags: { name: 'checkout' } }), { 'checkout 200': (x) => x.status === 200 });
  });
  if (!visitaId) return;
  pausa(3, 8);

  group('04 feedback', () => {
    const nota = 1 + Math.floor(Math.random() * 5);
    const r = http.post(`${API}/api/v1/feedbacks`, JSON.stringify({
      visitaId,
      foiAtendido: 'SIM',
      teveMedico: 'SIM',
      fezTriagem: 'SIM',
      medicacaoReceita: 'NAO_PRECISEI',
      nota,
      tratamentoEquipe: nota,
      comentario: '[perf] teste de carga automatizado',
    }), { ...json(null, token), tags: { name: 'feedback' } });
    check(r, { 'feedback 201': (x) => x.status === 201 });
  });
  pausa(2, 4);

  group('05 historico', () => {
    check(http.get(`${API}/api/v1/contas/visitas?page=0&size=20`, { headers: auth, tags: { name: 'historico_visitas' } }),
      { 'historico visitas 200': (x) => x.status === 200 });
    check(http.get(`${API}/api/v1/contas/feedbacks?page=0&size=20`, { headers: auth, tags: { name: 'historico_feedbacks' } }),
      { 'historico feedbacks 200': (x) => x.status === 200 });
    pausa(1, 3);
    check(http.get(`${API}/api/v1/hospitais/ranking?page=0&size=20`, { tags: { name: 'ranking' } }),
      { 'ranking 200': (x) => x.status === 200 });
  });
}

// ------------------------------------------------------------------ vigia

// null = SEM DADO (Prometheus fora, coleta falhando, serie ausente). Nunca vira 0: um vigia
// que le "0 op/s" quando a coleta do backend falha -- justamente sob carga pesada, quando a
// coleta pode estourar o tempo -- para de proteger o limite sem ninguem perceber.
function consultar(expr) {
  const r = http.get(`${PROMETHEUS}/api/v1/query?query=${encodeURIComponent(expr)}`, { tags: { name: 'vigia' } });
  if (r.status !== 200) return null;
  const res = r.json('data.result');
  return res && res.length ? Number(res[0].value[1]) : null;
}

export function vigia() {
  let acima = 0;
  let semDado = 0;
  let viuCarga = false;
  const inicio = Date.now();
  const filtroTeste = TESTID ? `{testid="${TESTID}"}` : '';
  while (Date.now() - inicio < 10.5 * 60 * 1000) {
    sleep(10);
    const ops = consultar('sum(rate(mongodb_driver_commands_seconds_count{job="backend-hom"}[1m]))');
    const vusJornada = consultar(`sum(k6_vus${filtroTeste})`);
    if (ops === null) {
      // Sem leitura por 30 s = voando as cegas sobre o limite do Atlas: aborta.
      semDado += 1;
      console.warn(`[vigia] sem leitura das op/s do Mongo (${semDado}/3) — coleta do backend falhando?`);
      if (semDado >= 3) {
        exec.test.abort('Vigia sem leitura das operações do Mongo por 30 s — teste abortado por segurança');
      }
    } else {
      semDado = 0;
      acima = ops > MONGO_OPS_MAX ? acima + 1 : 0;
      console.log(`[vigia] Mongo ${ops.toFixed(1)} op/s (limite ${MONGO_OPS_MAX}) — VUs ${vusJornada}`);
      if (acima >= 3) {
        exec.test.abort(`Mongo acima de ${MONGO_OPS_MAX} op/s por 30 s — teste abortado para respeitar o limite do Atlas M0`);
      }
    }
    // Encerra quando a jornada termina: só o próprio vigia continua ativo (1 VU).
    if (vusJornada !== null && vusJornada > 1) viuCarga = true;
    if (viuCarga && vusJornada !== null && vusJornada <= 1) break;
  }
}
