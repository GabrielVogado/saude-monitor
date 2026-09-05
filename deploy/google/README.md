# Deploy do backend no Google Cloud Run

Substitui o Render como destino de publicacao do backend a partir de 04/09/2026.
O workflow do Render (`cd-backend-render.yml`) continua no repositorio, sem gatilho
automatico, como caminho de rollback ate o Cloud Run estar validado.

## Ambientes

| Branch | Ambiente | Servico no Cloud Run | Sufixo dos secrets |
|---|---|---|---|
| `develop` | dev | `saude-monitor-backend-dev` | `-dev` |
| `master`, `release/**` | prod | `saude-monitor-backend` | `-prod` |

Regiao: `southamerica-east1` (Sao Paulo). Imagens no Artifact Registry
`southamerica-east1-docker.pkg.dev/<PROJECT_ID>/saude-monitor-google/`.

## Pre-requisito: provisionar o projeto

O workflow nao cria infraestrutura -- ele assume que ela existe. Rodar uma vez:

```bash
bash deploy/google/setup-gcp.sh
```

O script provisiona APIs, Artifact Registry, as duas service accounts, a
federacao de identidade (WIF) restrita a este repositorio e os secrets de `dev`.

## Autenticacao

Sem chave JSON no repositorio. O GitHub Actions troca seu token OIDC por
credencial do GCP via Workload Identity Federation, e a troca so e aceita para
`GabrielVogado/saude-monitor` (`attribute-condition` do provider).

Duas identidades, de proposito:

- `saude-monitor-gitdeploy@` — constroi e implanta. Nao le secrets.
- `saude-monitor-run@` — identidade de execucao do container. Le os secrets, nao
  implanta nada.

## Configuracao de runtime

Nao-sensivel, via `env_vars` do workflow: `MONGO_DATABASE`, `MONGO_AUTH_DB`.

Sensivel, via Secret Manager (`secrets` do workflow): `MONGO_URI` e `JWT_SECRET`
-- os nomes conforme existem no projeto, sem sufixo em `dev` e com `_PROD` em
producao. Nunca em `env_vars`: valores ali ficam legiveis em texto claro na
especificacao da revisao para qualquer um com `viewer`.

**`ADMIN_EMAIL` e `ADMIN_SENHA` nao existem no Secret Manager.** Enquanto for
assim, o deploy passa `APP_SEEDADMIN_ENABLED=false` e nenhum admin e criado.
Sem isso, `application.properties:70-71` cairia em `admin@saude.com` /
`admin123` num servico com `--allow-unauthenticated`. Para ligar o seed:

```bash
printf 'SEU_EMAIL' | gcloud secrets create ADMIN_EMAIL --data-file=- --replication-policy=automatic
gcloud secrets create ADMIN_SENHA --data-file=- --replication-policy=automatic   # cole a senha e Ctrl+D
```

e entao trocar `APP_SEEDADMIN_ENABLED=false` por essas duas entradas em `secrets:`.

## Pontos em aberto

- **Cold start.** `--min-instances=0` mantem o custo em zero e traz de volta o
  problema que motivou a saida do Render: a primeira requisicao apos ociosidade
  paga o startup do Spring Boot mais o seed DBF/SHP. `--min-instances=1` elimina
  o cold start e passa a cobrar instancia ociosa. Decisao do PO, ainda nao tomada.
- **`--allow-unauthenticated`.** O servico e publico porque o app mobile o consome
  sem proxy. Depende de `roles/run.invoker` para `allUsers`, que a organizacao pode
  bloquear via policy.
- **Recursos.** `1Gi`/`1 vCPU` e uma estimativa para JVM + seed no startup, nao uma
  medicao. Revisar depois do primeiro deploy real.
