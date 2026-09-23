#!/usr/bin/env bash
# Remove da HOMOLOGAÇÃO os dados gerados pelo teste de desempenho (visitas, feedbacks e
# os agregados que eles alteraram). Rodar depois de cada bateria.
#
#   bash perf/scripts/limpar.sh              # mantém os usuários de carga (para a próxima)
#   bash perf/scripts/limpar.sh --tudo       # remove também os usuários de carga e o ADMIN
set -euo pipefail
cd "$(dirname "$0")/.."

PROJETO=project-300769db-2135-4560-a83
REMOVER_USUARIOS=0
[ "${1:-}" = "--tudo" ] && REMOVER_USUARIOS=1
export REMOVER_USUARIOS

command -v gcloud >/dev/null || export PATH="$PATH:/c/Users/$USERNAME/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
MONGO_URI=$(gcloud secrets versions access latest --secret=MONGO_URI_HOM --project "$PROJETO")
export MONGO_URI
case "$MONGO_URI" in
  */saude_monitor_hom*) ;;
  *) echo "ERRO: MONGO_URI_HOM não aponta para saude_monitor_hom — abortado."; exit 1 ;;
esac

# MSYS_NO_PATHCONV so aqui: o Git Bash converteria os caminhos do contêiner (/scripts),
# mas desligar a conversao no script todo quebra o proprio gcloud.
MSYS_NO_PATHCONV=1 docker run --rm -e MONGO_URI -e REMOVER_USUARIOS \
  -v "$(pwd -W 2>/dev/null || pwd)/mongo:/scripts:ro" mongo:8 \
  mongosh --nodb --quiet --file /scripts/limpar.js
unset MONGO_URI
