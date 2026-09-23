#!/usr/bin/env bash
# Executa um cenário de desempenho contra a HOMOLOGAÇÃO e gera o relatório.
#
#   bash perf/scripts/executar.sh baseline    # sempre primeiro (2 usuários)
#   bash perf/scripts/executar.sh carga100    # 100 usuários simultâneos
#
# Durante a execução, acompanhe ao vivo em http://localhost:3000 (painel "Radar Saúde —
# Desempenho"). Resultados em perf/resultados/<data>-<cenário>/:
#   summary.json        resumo exportado pelo k6
#   k6.log              saída do k6 (inclui o vigia de op/s do Mongo)
#   servidor.json       métricas do backend na janela do teste (Prometheus)
#   relatorio.md        relatório de análise (cliente + servidor + limites gratuitos)
set -euo pipefail
cd "$(dirname "$0")/.."

CENARIO=${1:?uso: executar.sh baseline|carga100}
[ -f .env ] || { echo "ERRO: rode antes scripts/preparar.sh (cria perf/.env e os usuários)."; exit 1; }

ID="$(date +%Y%m%d-%H%M%S)-$CENARIO"
SAIDA="resultados/$ID"
mkdir -p "$SAIDA"

echo "== Subindo Prometheus + Grafana (se ainda não estiverem de pé)"
docker compose --env-file .env up -d

echo "== Aguardando o Prometheus coletar o backend (login do ADMIN + primeira coleta)"
for i in $(seq 1 30); do
  SAUDE=$(curl -s "http://127.0.0.1:9090/api/v1/targets?state=active" | node -e '
    let t = ""; process.stdin.on("data", (c) => (t += c)).on("end", () => {
      try { const a = JSON.parse(t).data.activeTargets.find((x) => x.labels.job === "backend-hom");
            process.stdout.write(a ? a.health : ""); } catch { process.stdout.write(""); } });' || true)
  [ "$SAUDE" = "up" ] && { echo "   coleta do backend: up"; break; }
  [ "$i" = 30 ] && { echo "ERRO: o Prometheus não conseguiu coletar o backend (veja: docker compose logs token prometheus)."; exit 1; }
  sleep 5
done

INICIO=$(date +%s)
echo "== Executando o cenário $CENARIO — acompanhe em http://localhost:3000"
set +e
MSYS_NO_PATHCONV=1 docker compose --env-file .env --profile carga run --rm -e CENARIO="$CENARIO" -e TESTID="$ID" k6 run \
  -o experimental-prometheus-rw \
  --tag testid="$ID" \
  --summary-export "/resultados/$ID/summary.json" \
  /scripts/jornada.js 2>&1 | tee "$SAIDA/k6.log"
STATUS_K6=${PIPESTATUS[0]}
set -e
FIM=$(date +%s)
printf '{"inicio":%s,"fim":%s,"statusK6":%s}
' "$INICIO" "$FIM" "$STATUS_K6" > "$SAIDA/janela.json"

echo "== Coletando as métricas do servidor na janela do teste e gerando o relatório"
# +90 s: o Prometheus coleta a cada 10 s e o rate usa janela de 1 min.
sleep 30
node scripts/relatorio.mjs --saida "$SAIDA" --cenario "$CENARIO" --inicio "$INICIO" --fim "$FIM" --status-k6 "$STATUS_K6"

# Relatório padronizado da skill de performance (se estiver instalada neste computador).
SKILL=../.claude/skills/performance-testing-skill/scripts
if [ -f "$SKILL/normalize-k6-summary.js" ] && [ -f "$SAIDA/summary.json" ]; then
  node "$SKILL/normalize-k6-summary.js" "$SAIDA/summary.json" --output "$SAIDA/normalizado.json" >/dev/null
  node "$SKILL/generate-performance-report.js" "$SAIDA/normalizado.json" --output "$SAIDA/relatorio-skill.md" >/dev/null
fi

echo
echo "Relatório: perf/$SAIDA/relatorio.md"
echo "k6 terminou com código $STATUS_K6 (0 = limiares atendidos; 99 = limiar reprovado; 108 = abortado pelo vigia/limiar)."
echo "Ao terminar os testes do dia: docker compose --env-file .env down   (e scripts/limpar.sh)"
