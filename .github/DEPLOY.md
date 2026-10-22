# Deploy CI/CD — Clinical Sanctuary (MVP, 100% gratuito)

Este guia configura o pipeline de CI/CD usando **GitHub Actions** + serviços gratuitos, com ambientes separados por branch: **dev** (`develop`) e **homologação** (`master`, desde 22/09/2026). Produção (`release/<tag>`) ainda não foi criada.

> O backend roda no **Google Cloud Run** desde 04/09/2026. O Render, que era o caminho de
> rollback, foi aposentado em 22/10/2026 (M-060): os workflows `cd-backend-render.yml` e
> `keep-alive-backend.yml` e os blueprints `render.yaml` saíram do repositório. A
> referência do backend é [`deploy/google/README.md`](../deploy/google/README.md).

## Arquitetura

| Componente | Serviço | Custo |
|-----------|---------|-------|
| CI (build + testes) | GitHub Actions | Gratuito (2000 min/mês) |
| Backend (Spring Boot) | **Google Cloud Run** (`southamerica-east1`) | Escala a zero — ver ADR-011 |
| Banco (MongoDB) | MongoDB Atlas (M0) | Gratuito |
| Frontend (Expo web) | — **sem provedor definido** | — |
| Imagem Docker | Google Artifact Registry | Cota gratuita do GCP |

## Ambientes

| Ambiente | Branch/Tag | Backend (Cloud Run) | Frontend web | Banco (Atlas) |
|----------|-----------|------------------|--------------------|---------------|
| **dev** (desenvolvimento) | `develop` | `saude-monitor-backend-dev` — `https://saude-monitor-backend-dev-uly57kmmia-rj.a.run.app` | — (sem provedor) | `saude_monitor_dev` |
| **hom** (homologação) | `master` | `saude-monitor-backend-hom` — criado no 1º deploy do `cd-homologacao.yml`; exige os secrets `_HOM` (`bash deploy/google/setup-homologacao.sh`) | — (sem provedor) | `saude_monitor_hom` |
| **prod** (produção) | `release/<tag>` | `saude-monitor-backend` ⚠️ *não criado* — os secrets `_PROD` também não existem, e o deploy falha de propósito | — (sem provedor) | `saude_monitor_prod` ⚠️ *não criado* |

> O APK de homologação ("Radar Saúde HML") é publicado como **GitHub Release** a cada
> tag `vX.Y.Z-rc.N` e instala por cima da rc anterior. Ver
> `Documentos/10-git-flow/MANUAL.md` §3.3 e `deploy/android/README.md`.

## Fluxo

```
push/PR → CI (build+teste backend e frontend)
push em develop → CD dev  (Docker → Artifact Registry:dev → Cloud Run -dev) + APK DEV (artefato)
push em master  → CD homologação: vX.Y.Z-rc.N → Cloud Run -hom (+ smoke tests)
                  → APK HML → tag + GitHub Release com o APK
push em release/<tag> → CD prod (Docker → Artifact Registry:<tag> → Cloud Run prod, versao fixada)
```

## Passo a passo

### 1. MongoDB Atlas (gratuito)
1. Crie conta em https://www.mongodb.com/atlas
2. Crie um cluster **M0** (free tier) na região mais próxima.
3. Em "Database Access", crie um usuário com senha.
4. Em "Network Access", libere o IP `0.0.0.0/0` (o Cloud Run não tem IP de saída fixo sem conector VPC).
5. Copie a string de conexão: `cluster0.xxxxx.mongodb.net`.
6. Crie os bancos por ambiente. Hoje existe apenas `saude_monitor_dev`.

### 2. Google Cloud Run (backend)
Projeto, federação de identidade e Artifact Registry: [`deploy/google/README.md`](../deploy/google/README.md).
Credenciais do backend ficam no Secret Manager do Google Cloud, não no GitHub.

### 3. Frontend web — sem provedor (03/09/2026)

Não há hospedagem configurada para o frontend web. A esteira `cd-frontend.yml` foi
**removida**: os segredos `NETLIFY_*` nunca existiram, então ela ficava verde sem
publicar nada, em 36 execuções. O build `npx expo export --platform web` continua
sendo validado pelo `ci.yml`. A distribuição hoje é o **APK**, via `cd-mobile-apk.yml` (Gradle no Actions, automático em `develop` e também manual, sem cota do EAS). Pacote, nome e versão mudam por ambiente — ver `deploy/android/README.md`.

### 4. Secrets no GitHub
No repositório: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Valor |
|--------|-------|
| `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_STORE_PASSWORD`, `ANDROID_RELEASE_KEY_ALIAS`, `ANDROID_RELEASE_KEY_PASSWORD` | Chave de release do APK (22/09/2026). **Obrigatórios para homologação/produção** — sem eles o build desses ambientes falha. Em dev, sem eles, cada build gera uma chave e o APK não atualiza por cima do anterior. Como criar: `deploy/android/README.md` |
| `ANDROID_KEYSTORE_BASE64` | *(legado, opcional)* debug.keystore estável para dev enquanto a chave de release não existe |

### 5. Gerar release de produção
1. Faça merge de `develop` → `master` e valide a rc em homologação (a tag e o APK saem sozinhos).
2. Escolha a rc validada (ex.: `v1.0.0-rc.3`).
3. No GitHub, **Actions → Release - Gerar branch de produção → Run workflow**, informando essa rc.
4. A branch `release/1.0.0` é criada a partir **da tag da rc**, não da ponta da `master`. **Nada dispara sozinho**, e a razão não é o filtro de `paths`: o `release.yml` empurra a branch com o `GITHUB_TOKEN`, e a regra de recursão do GitHub não cria execução de workflow para push feito com esse token. O AAB sai por execução manual do `cd-mobile-eas.yml` a partir dessa branch; o deploy do backend depende da P-006.
5. Após validar, faça merge de `release/1.0.0` de volta em `master` (e `develop`).

## Workflows

| Arquivo | Gatilho | Ação |
|---------|---------|------|
| `.github/workflows/ci.yml` | push/PR em develop/master | Build + testes backend e frontend |
| `.github/workflows/cd-homologacao.yml` | push master + manual | Homologação: versão → backend HML → APK HML → tag + GitHub Release |
| `.github/workflows/cd-backend-google.yml` | push develop/release **+ caminho `backend/**`**, manual e `workflow_call` (homologação) | Docker -> Artifact Registry -> deploy no Google Cloud Run (southamerica-east1). Autenticacao por Workload Identity Federation. Ver `deploy/google/README.md` |
| `.github/workflows/cd-mobile-apk.yml` | push `develop` (caminho `frontend/**`) + manual + `workflow_call` | APK com Gradle no Actions — sem cota do EAS. Artefato do run, 30 dias. Reutilizável pelo orquestrador de homologação (ambiente, URL e versão) |
| `.github/workflows/cd-mobile-eas.yml` | **só manual** (`workflow_dispatch`, **a partir de `release/*`** — outras refs são recusadas) | AAB de loja no EAS |
| `.github/workflows/release.yml` | manual (workflow_dispatch) | Cria branch `release/<tag>` a partir da `master` |

## Observações

- O backend roda só no Cloud Run, `southamerica-east1`. Não há mais caminho de rollback para o Render (aposentado em 22/10/2026, M-060); o rollback é voltar o tráfego para uma revisão anterior do próprio Cloud Run.
- O **Cloud Run** recolhe a instância quando ociosa, e a primeira requisição depois disso devolve **HTTP 503 em ~14,8 s** (medido no log do Cloud Run em 05/09/2026), porque `--min-instances=0`. Ping periódico não é a correção: manter a instância acordada por fora é pagar a instância ociosa sem a medição que `--min-instances=1` deixaria explícita. Ver ADR-011.
- O **frontend web** é o build do Expo (`react-native-web`). O APK mobile sai do `cd-mobile-apk.yml` (Actions, automático na `develop`, ou manual) e também localmente, via `expo run:android --variant release`.
- Para o frontend web apontar para o backend correto por ambiente, ajuste em `frontend/app.json` → `expo.extra`:
  ```json
  "extra": {
    "apiBaseUrlWeb": "https://saude-monitor-backend-dev-uly57kmmia-rj.a.run.app"
  }
  ```
  (hoje `apiBaseUrlWeb` está em `http://localhost:8080`, de propósito: não há hospedagem web configurada.)
- **`extra` não é o que decide o APK.** `frontend/src/config/api.js` lê `process.env.EXPO_PUBLIC_API_BASE_URL` **primeiro**, e `cd-mobile-apk.yml` sempre a define — o `app.json` só entra quando nenhuma env var existe. Ao trocar o backend, virar os três pontos juntos: `app.json`, `frontend/scripts/build-apk.js` (build local) e o padrão em `cd-mobile-apk.yml`. Alternativa sem código: criar a variável de repositório `EXPO_PUBLIC_API_BASE_URL`, que tem precedência sobre o padrão do workflow.
