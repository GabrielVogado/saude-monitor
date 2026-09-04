#!/usr/bin/env bash
# Provisiona, no Google Cloud, tudo o que `.github/workflows/cd-backend-google.yml`
# assume que ja existe. Rodar UMA vez, com uma conta que tenha Owner no projeto.
#
#   bash deploy/google/setup-gcp.sh
#
# Idempotente: cada recurso e criado so se ainda nao existir.
set -euo pipefail

PROJECT_ID="project-300769db-2135-4560-a83"
PROJECT_NUMBER="767615581088"
REGION="southamerica-east1"
GAR_REPOSITORY="saude-monitor-google"
GITHUB_REPO="GabrielVogado/saude-monitor"

DEPLOYER_SA="github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA="saude-monitor-run@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="github-pool"
PROVIDER="github-provider"

gcloud config set project "$PROJECT_ID"

echo "== 1/7 APIs =="
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com

echo "== 2/7 Artifact Registry (${REGION}) =="
gcloud artifacts repositories describe "$GAR_REPOSITORY" --location="$REGION" >/dev/null 2>&1 || \
gcloud artifacts repositories create "$GAR_REPOSITORY" \
  --repository-format=docker --location="$REGION" \
  --description="Imagens do backend saude-monitor"

echo "== 3/7 Service accounts =="
gcloud iam service-accounts describe "$DEPLOYER_SA" >/dev/null 2>&1 || \
gcloud iam service-accounts create github-actions-deployer \
  --display-name="Deployer do GitHub Actions"
gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1 || \
gcloud iam service-accounts create saude-monitor-run \
  --display-name="Identidade de execucao do backend no Cloud Run"

echo "== 4/7 Papeis do deployer =="
for ROLE in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER_SA}" --role="$ROLE" --condition=None >/dev/null
done

# serviceAccountUser fica no RECURSO da SA de execucao, e nao no projeto. Concedido
# no projeto, ele deixaria o deployer personificar QUALQUER service account daqui --
# inclusive alguma mais privilegiada que ele proprio. Aqui, so a saude-monitor-run.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/iam.serviceAccountUser" >/dev/null

echo "== 5/7 Workload Identity Federation =="
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 || \
gcloud iam workload-identity-pools create "$POOL" --location=global \
  --display-name="GitHub Actions"

# attribute-condition restringe a federacao a ESTE repositorio. Sem ela, qualquer
# repositorio do GitHub troca seu token OIDC por credencial deste projeto.
if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
     --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1; then
  # O provider ja existe e este script NAO o altera -- criado sem condicao, ele
  # continuaria aberto. Conferir o valor impresso: precisa citar o repositorio.
  echo "  provider ja existe. attribute-condition atual:"
  gcloud iam workload-identity-pools providers describe "$PROVIDER" \
    --location=global --workload-identity-pool="$POOL" \
    --format="value(attributeCondition)" | sed 's/^/    /'
  echo "  VAZIO acima significa federacao aberta a qualquer repositorio. Corrigir com:"
  echo "    gcloud iam workload-identity-pools providers update-oidc ${PROVIDER} \\"
  echo "      --location=global --workload-identity-pool=${POOL} \\"
  echo "      --attribute-condition=\"assertion.repository == '${GITHUB_REPO}'\""
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location=global --workload-identity-pool="$POOL" \
    --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
fi

# O principalSet amarra a impersonacao ao atributo `repository`. Mesmo que a
# condicao do provider afrouxe, so tokens deste repositorio servem aqui.
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" >/dev/null

echo "== 6/7 Secrets (ambiente dev) =="
# Os valores NAO ficam neste arquivo nem na linha de comando: cada um e lido da
# entrada padrao e enviado por pipe.
criar_secret() {
  local NOME="$1" ROTULO="$2" VALOR
  if gcloud secrets describe "$NOME" >/dev/null 2>&1; then
    echo "  $NOME ja existe -- para atualizar: gcloud secrets versions add $NOME --data-file=-"
    return
  fi
  echo "  Informe o valor de ${ROTULO} (${NOME}) e finalize com Enter:"
  read -rs VALOR
  printf '%s' "$VALOR" | gcloud secrets create "$NOME" --data-file=- --replication-policy=automatic
}
criar_secret saude-monitor-mongo-uri-dev   "URI do MongoDB (mongodb+srv://...)"
criar_secret saude-monitor-jwt-secret-dev  "JWT_SECRET (>= 32 bytes)"
criar_secret saude-monitor-admin-email-dev "ADMIN_EMAIL"
criar_secret saude-monitor-admin-senha-dev "ADMIN_SENHA"

echo "== 7/7 Acesso da identidade de execucao aos secrets =="
# Só a SA de execucao le os secrets. O deployer nao recebe secretAccessor.
for SECRET in saude-monitor-mongo-uri-dev saude-monitor-jwt-secret-dev \
              saude-monitor-admin-email-dev saude-monitor-admin-senha-dev; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

echo
echo "Pronto. O workflow cd-backend-google.yml ja pode rodar para a branch develop."
echo "Para o ambiente de producao, repetir os passos 6 e 7 com o sufixo -prod."
