#!/usr/bin/env bash
# Cria, no Secret Manager, os secrets do ambiente de HOMOLOGACAO (`master`) que o
# `cd-backend-google.yml` le com o sufixo `_HOM`:
#
#   MONGO_URI_HOM       URI do banco `saude_monitor_hom` (usuario proprio no Atlas)
#   JWT_SECRET_HOM      gerado aqui, aleatorio -- ninguem precisa conhece-lo
#   RESEND_API_KEY_HOM  chave do Resend (pode copiar a de dev)
#
#   bash deploy/google/setup-homologacao.sh
#
# O servico `saude-monitor-backend-hom` nao e criado aqui: o primeiro deploy do
# `cd-homologacao.yml` o cria. Os valores nunca aparecem na tela nem na linha de comando
# (lidos sem eco e enviados por pipe). Idempotente: secret existente nao e sobrescrito.
set -euo pipefail

PROJECT_ID="project-300769db-2135-4560-a83"
RUNTIME_SA="saude-monitor-run@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID" >/dev/null

existe() { gcloud secrets describe "$1" >/dev/null 2>&1; }

criar() { # nome -- valor chega pela entrada padrao
  # Valor vazio e recusado ANTES de criar: o `gcloud secrets create` cria o secret e so
  # entao falha ao gravar a versao, deixando um secret sem versao que a proxima
  # execucao trataria como "ja existe" -- e o deploy morreria com "version latest not
  # found", sem pista de que a causa esta aqui.
  local VALOR
  VALOR=$(cat)
  if [ -z "$VALOR" ]; then
    echo "  ERRO: valor vazio para $1 -- nada foi criado."
    exit 1
  fi
  printf '%s' "$VALOR" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic >/dev/null
  echo "  $1 criado."
}

echo "== MONGO_URI_HOM =="
if existe MONGO_URI_HOM; then
  echo "  ja existe -- para trocar: gcloud secrets versions add MONGO_URI_HOM --data-file=-"
else
  echo "  Cole a URI do Atlas (usuario saude_monitor_hom, banco /saude_monitor_hom) e tecle Enter:"
  read -rs URI
  case "$URI" in
    mongodb*://*/saude_monitor_hom*) ;;
    *) echo "  ERRO: a URI precisa apontar para o banco /saude_monitor_hom -- nunca o de dev."; exit 1 ;;
  esac
  printf '%s' "$URI" | criar MONGO_URI_HOM
  unset URI
fi

echo "== JWT_SECRET_HOM =="
if existe JWT_SECRET_HOM; then
  echo "  ja existe."
else
  # Diferente do de dev por regra do projeto: um token emitido em um ambiente nao pode
  # valer no outro.
  openssl rand -base64 48 | tr -d '\n' | criar JWT_SECRET_HOM
fi

echo "== RESEND_API_KEY_HOM =="
if existe RESEND_API_KEY_HOM; then
  echo "  ja existe."
else
  read -rp "  Reaproveitar a chave do Resend de dev? [S/n] " REUSAR
  if [ "${REUSAR:-S}" != "n" ] && [ "${REUSAR:-S}" != "N" ]; then
    gcloud secrets versions access latest --secret=RESEND_API_KEY | criar RESEND_API_KEY_HOM || exit 1
  else
    echo "  Cole a chave do Resend e tecle Enter:"
    read -rs CHAVE
    printf '%s' "$CHAVE" | criar RESEND_API_KEY_HOM
    unset CHAVE
  fi
fi

echo "== Acesso da identidade de execucao =="
# Hoje a SA de execucao ja tem secretAccessor no projeto inteiro (verificado em
# 22/09/2026); o binding por secret deixa o acesso explicito caso aquele seja removido.
for SECRET in MONGO_URI_HOM JWT_SECRET_HOM RESEND_API_KEY_HOM; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

echo
echo "Pronto. O proximo push na master publica saude-monitor-backend-hom (cd-homologacao.yml)."
