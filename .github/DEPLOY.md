# Deploy CI/CD — Clinical Sanctuary (MVP, 100% gratuito)

Este guia configura o pipeline de CI/CD usando **GitHub Actions** + serviços gratuitos, com ambientes separados por branch (hoje **só `dev` existe** — ver a tabela abaixo).

## Arquitetura

| Componente | Serviço | Custo |
|-----------|---------|-------|
| CI (build + testes) | GitHub Actions | Gratuito (2000 min/mês) |
| Backend (Spring Boot) | Render (free web service) | Gratuito |
| Banco (MongoDB) | MongoDB Atlas (M0) | Gratuito |
| Frontend (Expo web) | — **sem provedor definido** | — |
| Imagem Docker | GitHub Container Registry (GHCR) | Gratuito |

## Ambientes

| Ambiente | Branch/Tag | Backend (Render) | Frontend web | Banco (Atlas) |
|----------|-----------|------------------|--------------------|---------------|
| **dev** (desenvolvimento) | `develop` | `saude-monitor-backend-dev` | — (sem provedor) | `saude_monitor_dev` |
| **prod** (produção) | `master` · `release/<tag>` | `saude-monitor-backend-prod` ⚠️ *não criado* | — (sem provedor) | `saude_monitor_prod` ⚠️ *não criado* |

> ⚠️ **Só o ambiente `dev` existe hoje** — é o único Web Service no Render e o único com secrets.

## Fluxo

```
push/PR → CI (build+teste backend e frontend)
push em develop → CD dev  (Docker → GHCR:dev  → Render dev)
push em master  → CD prod (Docker → GHCR:prod → Render prod)
push em release/<tag> → CD prod (Docker → GHCR:<tag> → Render prod, versao fixada)
```

## Passo a passo

### 1. MongoDB Atlas (gratuito)
1. Crie conta em https://www.mongodb.com/atlas
2. Crie um cluster **M0** (free tier) na região mais próxima.
3. Em "Database Access", crie um usuário com senha.
4. Em "Network Access", libere o IP `0.0.0.0/0` (ou o IP do Render).
5. Copie a string de conexão: `cluster0.xxxxx.mongodb.net`.
6. Crie os bancos por ambiente. Hoje existe apenas `saude_monitor_dev`.

### 2. Render (backend, gratuito)
1. Crie conta em https://render.com
2. Gere um **API Key** em Account Settings → API Keys.
3. Crie um Web Service por ambiente (ou use o `render.yaml` via Blueprint) apontando para as imagens GHCR (`:dev`, `:prod`, `:<tag>`). Hoje existe apenas o de `dev`.
4. Preencha as variáveis de ambiente de cada um (ver `backend/.env.example`).
5. Anote os **Service IDs** de cada ambiente.

### 3. Frontend web — sem provedor (03/09/2026)

Não há hospedagem configurada para o frontend web. A esteira `cd-frontend.yml` foi
**removida**: os segredos `NETLIFY_*` nunca existiram, então ela ficava verde sem
publicar nada, em 36 execuções. O build `npx expo export --platform web` continua
sendo validado pelo `ci.yml`. A distribuição hoje é o **APK**, via `cd-mobile-apk.yml` (Gradle no Actions, manual, sem cota do EAS).

### 4. Secrets no GitHub
No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
Cada secret tem sufixo `_DEV` ou `_PROD`:

| Secret | Valor |
|--------|-------|
| `RENDER_API_KEY_DEV` / `_PROD` | API Key do Render (pode ser a mesma). O sufixo `_HOM` deixou de existir: depois da P-004 o `resolve-env` só emite `dev` ou `prod`, e um secret `_HOM` nunca seria lido |
| `ANDROID_KEYSTORE_BASE64` | *(opcional)* keystore do APK em base64. Sem ela o `cd-mobile-apk.yml` gera uma a cada build, e a assinatura deixa de ser estável |
| `RENDER_SERVICE_ID_DEV` / `_PROD` | ID do serviço do backend em cada ambiente. Hoje só `_DEV` está configurado |

### 5. Variáveis de ambiente no Render
Em cada Web Service, configure (ver `backend/.env.example`):
- `MONGO_HOST`, `MONGO_PORT`, `MONGO_DATABASE`, `MONGO_AUTH_DB`, `MONGO_USER`, `MONGO_PASSWORD`
- `JWT_SECRET` (chave aleatória ≥ 32 bytes, **diferente por ambiente**)
- `ADMIN_EMAIL`, `ADMIN_SENHA`
- `APP_SEED_ENABLED=false`

### 6. Gerar release de produção
1. Faça merge de `develop` → `master` (produção contínua é deployada automaticamente).
2. Valide em produção contínua antes de fixar a versão.
3. No GitHub, **Actions → Release - Gerar branch de produção → Run workflow**, informando a versão (ex.: `1.0.0`).
4. A branch `release/1.0.0` é criada a partir da `master`. **Nada dispara sozinho:** o AAB sai por execução manual do `cd-mobile-eas.yml` a partir dessa branch, e o deploy do backend não dispara porque o `cd-backend.yml` filtra por `paths: backend/**` e a criação da branch não carrega diff (P-006).
5. Após validar, faça merge de `release/1.0.0` de volta em `master` (e `develop`).

## Workflows

| Arquivo | Gatilho | Ação |
|---------|---------|------|
| `.github/workflows/ci.yml` | push/PR em develop/master | Build + testes backend e frontend |
| `.github/workflows/cd-backend.yml` | push develop/master/release **+ caminho `backend/**`** | Docker → GHCR → deploy Render. Falha com mensagem explícita se o ambiente não tiver secrets |
| `.github/workflows/cd-mobile-apk.yml` | push `develop`/`master` (caminho `frontend/**`) + manual | APK interno com Gradle no Actions — sem cota do EAS. Artefato do run, 30 dias |
| `.github/workflows/cd-mobile-eas.yml` | **só manual** (`workflow_dispatch`) | AAB de loja no EAS |
| `.github/workflows/keep-alive-backend.yml` | cron a cada 10 min, 07h–22h + manual | Ping em `/actuator/health` contra a hibernação do Render (E8-01) |
| `.github/workflows/release.yml` | manual (workflow_dispatch) | Cria branch `release/<tag>` a partir da `master` |

## Observações

- O **Render free** "dorme" após ~15 min de inatividade e acorda na primeira requisição (pode demorar ~30s). Ideal para testes.
- O **frontend web** é o build do Expo (`react-native-web`). O APK mobile sai do `cd-mobile-apk.yml` (Actions, manual) ou, localmente, via `expo run:android --variant release`.
- Para o frontend web apontar para o backend correto por ambiente, adicione em `frontend/app.json` → `expo.extra`:
  ```json
  "extra": {
    "apiBaseUrlWeb": "https://saude-monitor-backend-dev.onrender.com"
  }
  ```
  (o `api.js` já lê `extra.apiBaseUrlWeb`; o app mobile usa `apiBaseUrlAndroid`/`apiBaseUrlIos`).
