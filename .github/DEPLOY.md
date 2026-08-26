# Deploy CI/CD — Clinical Sanctuary (MVP, 100% gratuito)

Este guia configura o pipeline de CI/CD usando **GitHub Actions** + serviços gratuitos.

## Arquitetura

| Componente | Serviço | Custo |
|-----------|---------|-------|
| CI (build + testes) | GitHub Actions | Gratuito (2000 min/mês) |
| Backend (Spring Boot) | Render (free web service) | Gratuito |
| Banco (MongoDB) | MongoDB Atlas (M0) | Gratuito |
| Frontend (Expo web) | Netlify | Gratuito |
| Imagem Docker | GitHub Container Registry (GHCR) | Gratuito |

## Fluxo

```
push/PR → CI (build+teste backend e frontend)
push em main → CD backend (build Docker → GHCR → deploy Render)
push em main → CD frontend (build web → deploy Netlify)
```

## Passo a passo

### 1. MongoDB Atlas (gratuito)
1. Crie conta em https://www.mongodb.com/atlas
2. Crie um cluster **M0** (free tier) na região mais próxima.
3. Em "Database Access", crie um usuário com senha.
4. Em "Network Access", libere o IP `0.0.0.0/0` (ou o IP do Render).
5. Copie a string de conexão: `cluster0.xxxxx.mongodb.net`.

### 2. Render (backend, gratuito)
1. Crie conta em https://render.com
2. Gere um **API Key** em Account Settings → API Keys.
3. Crie um **Web Service** (ou use o `render.yaml` via Blueprint) apontando para a imagem GHCR.
4. Preencha as variáveis de ambiente (ver `backend/.env.example`).
5. Anote o **Service ID** (URL da API: `https://api.render.com/v1/services/<ID>`).

### 3. Netlify (frontend, gratuito)
1. Crie conta em https://www.netlify.com
2. Gere um **Auth Token** em User Settings → Applications → New access token.
3. Crie um site (ou use "Add new site" → Deploy manually) e anote o **Site ID**.

### 4. Secrets no GitHub
No repositório: **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|--------|-------|
| `RENDER_API_KEY` | API Key do Render |
| `RENDER_SERVICE_ID` | ID do serviço do backend no Render |
| `NETLIFY_AUTH_TOKEN` | Token de acesso do Netlify |
| `NETLIFY_SITE_ID` | ID do site no Netlify |

### 5. Variáveis de ambiente no Render
No Web Service do backend, configure (ver `backend/.env.example`):
- `MONGO_HOST`, `MONGO_PORT`, `MONGO_DATABASE`, `MONGO_AUTH_DB`, `MONGO_USER`, `MONGO_PASSWORD`
- `JWT_SECRET` (chave aleatória ≥ 32 bytes)
- `ADMIN_EMAIL`, `ADMIN_SENHA`
- `APP_SEED_ENABLED=false` (desliga o seed de estabelecimentos em produção)

## Workflows

| Arquivo | Gatilho | Ação |
|---------|---------|------|
| `.github/workflows/ci.yml` | push/PR em develop/main | Build + testes backend e frontend |
| `.github/workflows/cd-backend.yml` | push em main (backend/**) | Docker → GHCR → deploy Render |
| `.github/workflows/cd-frontend.yml` | push em main (frontend/**) | Build web → deploy Netlify |

## Observações

- O **Render free** "dorme" após ~15 min de inatividade e acorda na primeira requisição (pode demorar ~30s). Ideal para testes.
- O **frontend web** é o build do Expo (`react-native-web`). O app mobile (APK) continua sendo gerado localmente via `expo run:android`.
- Para o frontend web apontar para o backend de produção, adicione em `frontend/app.json` → `expo.extra`:
  ```json
  "extra": {
    "apiBaseUrlWeb": "https://saude-monitor-backend.onrender.com"
  }
  ```
  (o `api.js` já lê `extra.apiBaseUrlWeb`; o app mobile usa `apiBaseUrlAndroid`/`apiBaseUrlIos`).
