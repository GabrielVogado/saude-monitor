/**
 * Regra "avaliação suficiente" (RN-15): um hospital só mostra nota/tempo quando tem
 * pelo menos 5 avaliações. Extraída de CSHospitalCard.js e HospitalDetalheScreen.js
 * (08/09/2026, auditoria de código morto/lógica ambígua) — as duas telas
 * reimplementavam o critério de forma independente, com uma diferença sutil (o
 * detalhe checava `indicadoresDisponiveis`, o card não). Hoje os dois campos
 * concordam porque o backend deriva um do outro (`HospitalService.js`), mas isso era
 * um acoplamento implícito, não garantido pelo contrato — exatamente o tipo de
 * divergência que já gerou bug antes (PR #94/#95).
 *
 * @param {{ notaMedia?: number|null, nAvaliacoes?: number, indicadoresDisponiveis?: boolean }} indicadores
 */
export function avaliacaoSuficiente(indicadores) {
  return (
    indicadores?.indicadoresDisponiveis !== false &&
    indicadores?.notaMedia !== null &&
    indicadores?.notaMedia !== undefined &&
    indicadores?.nAvaliacoes >= 5
  );
}
