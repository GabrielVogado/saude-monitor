// Remove do banco de HOMOLOGAÇÃO tudo o que o teste de desempenho gerou: visitas,
// feedbacks, refresh tokens revogados e — com REMOVER_USUARIOS=1 — os próprios usuários de carga.
//
// Agregados (nota e tempo médio) dos hospitais tocados pelo teste — foram calculados com os
// feedbacks de teste:
//   - hospital SEM nenhum dado real restante: o agregado é apagado; volta a "Ainda sem
//     avaliações suficientes", que é o estado correto;
//   - hospital COM dado real (avaliação ou visita de alguém de verdade): o agregado NÃO é
//     apagado — isso sumiria com a nota real (achado do code-review). A visita real mais
//     recente é marcada para reprocessamento (`processadoEm = agora`), e o job do backend
//     (a cada 15 min) recalcula com as mesmas regras do app. Replicar o cálculo aqui
//     arriscaria divergir delas (janela, cobertura de GPS, mediana).

// Conecta pela URI da variavel de ambiente (mongosh --nodb) -- ver criar-usuarios.js.
db = connect(process.env.MONGO_URI);
const banco = db.getSiblingDB('saude_monitor_hom');
if (db.getName() !== 'saude_monitor_hom') {
  throw new Error(`conectado ao banco ${db.getName()}, esperado saude_monitor_hom — abortado`);
}

const usuarios = banco.users.find({ email: /@carga\.radarsaude\.test$/ }, { _id: 1 }).toArray();
const ids = usuarios.map((u) => u._id.toString());
const idsObj = usuarios.map((u) => u._id);
const filtroUsuario = { usuarioId: { $in: ids } };

const hospitais = [
  ...new Set([
    ...banco.visitas.distinct('hospitalId', filtroUsuario),
    ...banco.feedbacks.distinct('hospitalId', filtroUsuario),
  ]),
];

const r = {
  feedbacks: banco.feedbacks.deleteMany(filtroUsuario).deletedCount,
  visitas: banco.visitas.deleteMany({ $or: [filtroUsuario, { dispositivoId: /^perf-/ }] }).deletedCount,
};

// Depois de apagar os dados de teste, o que sobra em cada hospital tocado é dado real.
const semDadoReal = [];
const paraRecalcular = [];
for (const hospitalId of hospitais) {
  const temFeedbackReal = banco.feedbacks.countDocuments({ hospitalId }, { limit: 1 }) > 0;
  const visitaReal = banco.visitas.find({ hospitalId, status: { $in: ['FINALIZADA', 'GPS_INTERROMPIDO'] } })
    .sort({ saida: -1 }).limit(1).toArray()[0];
  if (!temFeedbackReal && !visitaReal) {
    semDadoReal.push(hospitalId);
  } else if (visitaReal) {
    banco.visitas.updateOne({ _id: visitaReal._id }, { $set: { processadoEm: new Date() } });
    paraRecalcular.push(hospitalId);
  } else {
    // Feedback real sem visita finalizada: não há o que marcar; recalcula no próximo evento.
    paraRecalcular.push(hospitalId);
  }
}
r.agregadosApagados = banco.agregados_hospitais.deleteMany({ hospitalId: { $in: semDadoReal } }).deletedCount;
r.agregadosParaRecalcular = paraRecalcular;

// O JWT é sem estado: só a lista de refresh tokens REVOGADOS guarda algo por usuário (por
// e-mail). A jornada não faz logout, mas uma execução manual poderia ter feito.
r.refreshTokensRevogados = banco.refresh_tokens_revogados
  .deleteMany({ email: /@carga\.radarsaude\.test$/ }).deletedCount;

if (process.env.REMOVER_USUARIOS === '1') {
  r.usuarios = banco.users.deleteMany({ _id: { $in: idsObj } }).deletedCount;
}

print(JSON.stringify({ usuariosDeTeste: ids.length, hospitaisTocados: hospitais.length, removidos: r }));
