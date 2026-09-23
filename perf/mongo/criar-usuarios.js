// Cria (ou atualiza) os usuários do teste de desempenho no banco de HOMOLOGAÇÃO.
//
// Direto no banco, e não pelo POST /auth/registro, de propósito: o cadastro envia e-mail
// de confirmação pelo Resend (cota gratuita de 100/dia) — 100 cadastros esgotariam a cota
// e o fluxo "esqueci minha senha" pararia até o dia seguinte.
//
// Entrada por variáveis de ambiente (ver scripts/preparar.sh):
//   PERF_HASH    hash BCrypt da senha comum dos usuários de carga
//   ADMIN_EMAIL  e-mail do ADMIN que o Prometheus usa para coletar /actuator/prometheus
//   ADMIN_HASH   hash BCrypt da senha desse ADMIN
//   QTD          quantidade de usuários de carga (padrão 100)
//
// Todos no domínio carga.radarsaude.test — `.test` é reservado (RFC 2606): nenhum e-mail
// para esses endereços sai de verdade, e a limpeza os encontra pelo sufixo.

// Conecta pela URI da variavel de ambiente (mongosh --nodb): a URI, com a senha, nao vira
// argumento de linha de comando -- nao aparece na lista de processos do conteiner.
db = connect(process.env.MONGO_URI);
const banco = db.getSiblingDB('saude_monitor_hom');
if (db.getName() !== 'saude_monitor_hom') {
  throw new Error(`conectado ao banco ${db.getName()}, esperado saude_monitor_hom — abortado`);
}

const agora = new Date();
const consentimento = { aceito: true, data: agora, versao: 'perf' };
const CLASSE = 'br.com.saude_monitor.api.user.document.UserDocument';

function upsert(email, nome, hash, papel) {
  banco.users.updateOne(
    { email },
    {
      $set: {
        fullName: nome,
        senhaHash: hash,
        papel,
        active: true,
        emailVerificado: true,
        consentimentos: { localizacao: consentimento, notificacoes: consentimento, termosUso: consentimento },
        updatedAt: agora,
        _class: CLASSE,
      },
      $setOnInsert: { email, createdAt: agora },
    },
    { upsert: true },
  );
}

const qtd = Number(process.env.QTD || 100);
for (let i = 1; i <= qtd; i++) {
  const n = String(i).padStart(3, '0');
  upsert(`perf-${n}@carga.radarsaude.test`, `Perf Teste ${n}`, process.env.PERF_HASH, 'USER');
}
upsert(process.env.ADMIN_EMAIL, 'Perf Coletor de Métricas', process.env.ADMIN_HASH, 'ADMIN');

print(`usuarios de carga: ${banco.users.countDocuments({ email: /@carga\.radarsaude\.test$/, papel: 'USER' })}`);
print(`admin de coleta:   ${banco.users.countDocuments({ email: process.env.ADMIN_EMAIL, papel: 'ADMIN' })}`);
