#!/usr/bin/env bash
# Prepara a HOMOLOGAÇÃO para o teste de desempenho:
#   1. gera perf/.env (senhas aleatórias; nunca versionado) se ainda não existir;
#   2. cria/atualiza no banco saude_monitor_hom os usuários de carga (perf-001..perf-NNN)
#      e o ADMIN de coleta de métricas — direto no banco, sem e-mail (ver mongo/criar-usuarios.js).
#
#   bash perf/scripts/preparar.sh            # 100 usuários
#   QTD=10 bash perf/scripts/preparar.sh
#
# Credenciais: a URI do Mongo vem do Secret Manager (MONGO_URI_HOM) direto para o
# contêiner do mongosh, por variável de ambiente, e o script conecta com connect() — ela não
# aparece na tela, no histórico nem como argumento de processo. As senhas dos usuários de
# teste chegam ao htpasswd pela entrada padrão, pelo mesmo motivo. Exige `gcloud`
# autenticado e o Docker rodando.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJETO=project-300769db-2135-4560-a83
QTD=${QTD:-100}

command -v gcloud >/dev/null || export PATH="$PATH:/c/Users/$USERNAME/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
docker info >/dev/null 2>&1 || { echo "ERRO: o Docker não está rodando."; exit 1; }

if [ ! -f .env ]; then
  gerar() { openssl rand -hex 16; }
  cat > .env <<EOF
# Gerado por scripts/preparar.sh — NÃO versionar (perf/.gitignore).
API_URL=https://saude-monitor-backend-hom-767615581088.southamerica-east1.run.app
ADMIN_EMAIL=perf-coletor@carga.radarsaude.test
ADMIN_SENHA=$(gerar)
PERF_SENHA=$(gerar)
GRAFANA_SENHA=$(gerar)
EOF
  echo "perf/.env criado (senhas aleatórias)."
fi
set -a; . ./.env; set +a

# Hash BCrypt (o mesmo algoritmo do BCryptPasswordEncoder do backend), gerado num
# contêiner descartável do htpasswd. Só o hash vai para o banco.
bcrypt() { printf '%s' "$1" | MSYS_NO_PATHCONV=1 docker run --rm -i httpd:2.4-alpine htpasswd -niBC 10 x | cut -d: -f2 | tr -d '\r\n'; }
PERF_HASH=$(bcrypt "$PERF_SENHA")
ADMIN_HASH=$(bcrypt "$ADMIN_SENHA")
export PERF_HASH ADMIN_HASH QTD

MONGO_URI=$(gcloud secrets versions access latest --secret=MONGO_URI_HOM --project "$PROJETO")
export MONGO_URI
case "$MONGO_URI" in
  */saude_monitor_hom*) ;;
  *) echo "ERRO: MONGO_URI_HOM não aponta para saude_monitor_hom — abortado."; exit 1 ;;
esac

# MSYS_NO_PATHCONV so aqui: o Git Bash converteria os caminhos do contêiner (/scripts),
# mas desligar a conversao no script todo quebra o proprio gcloud.
MSYS_NO_PATHCONV=1 docker run --rm -e MONGO_URI -e PERF_HASH -e ADMIN_HASH -e ADMIN_EMAIL -e QTD \
  -v "$(pwd -W 2>/dev/null || pwd)/mongo:/scripts:ro" mongo:8 \
  mongosh --nodb --quiet --file /scripts/criar-usuarios.js
unset MONGO_URI
