# Deploy CI/CD — Clinical Sanctuary (MVP, 100% gratuito)

Este guia configura o pipeline de CI/CD usando **GitHub Actions** + serviços gratuitos, com **3 ambientes separados**.

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
| **dev** (desenvolvimento) | `develop` | `saude-monitor-backend-dev` | site dev | `saude_monitor_dev` |
| **hom** (homologação) | `main` | `saude-monitor-backend-hom` | site hom | `saude_monitor_hom` |
| **prod** (produção) | `release/<tag>` | `saude-monitor-backend-prod` | site prod | `saude_monitor_prod` |

## Fluxo

```
push/PR → CI (build+teste backend e frontend)
push em develop → CD dev (Docker → GHCR:dev → Render dev)
push em main    → CD hom (Docker → GHCR:hom → Render hom)
push em release/<tag> → CD prod (Docker → GHCR:<tag> → Render prod)
```

## Passo a passo

### 1. MongoDB Atlas (gratuito)
1. Crie conta em https://www.mongodb.com/atlas
2. Crie um cluster **M0** (free tier) na região mais próxima.
3. Em "Database Access", crie um usuário com senha.
4. Em "Network Access", libere o IP `0.0.0.0/0` (ou o IP do Render).
5. Copie a string de conexão: `cluster0.xxxxx.mongodb.net`.
6. Crie 3 bancos: `saude_monitor_dev`, `saude_monitor_hom`, `saude_monitor_prod`.

### 2. Render (backend, gratuito)
1. Crie conta em https://render.com
2. Gere um **API Key** em Account Settings → API Keys.
3. Crie **3 Web Services** (ou use o `render.yaml` via Blueprint) apontando para as imagens GHCR (`:dev`, `:hom`, `:v*`).
4. Preencha as variáveis de ambiente de cada um (ver `backend/.env.example`).
5. Anote os **Service IDs** de cada ambiente.

### 3. Frontend web — sem provedor (03/09/2026)

Não há hospedagem configurada para o frontend web. A esteira `cd-frontend.yml` foi
**removida**: os segredos `NETLIFY_*` nunca existiram, então ela ficava verde sem
publicar nada, em 36 execuções. O build `npx expo export --platform web` continua
sendo validado pelo `ci.yml`. A distribuição hoje é o **APK**, via `cd-mobile-eas.yml`.

### 4. Secrets no GitHub
No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
Cada secret tem sufixo `_DEV`, `_HOM` ou `_PROD`:

| Secret | Valor |
|--------|-------|
| `RENDER_API_KEY_DEV` / `_HOM` / `_PROD` | API Key do Render (pode ser a mesma) |
| `RENDER_SERVICE_ID_DEV` / `_HOM` / `_PROD` | ID do serviço do backend em cada ambiente |

### 5. Variáveis de ambiente no Render
Em cada Web Service, configure (ver `backend/.env.example`):
- `MONGO_HOST`, `MONGO_PORT`, `MONGO_DATABASE`, `MONGO_AUTH_DB`, `MONGO_USER`, `MONGO_PASSWORD`
- `JWT_SECRET` (chave aleatória ≥ 32 bytes, **diferente por ambiente**)
- `ADMIN_EMAIL`, `ADMIN_SENHA`
- `APP_SEED_ENABLED=false`

### 6. Gerar release de produção
1. Faça merge de `develop` → `main` (homologação é deployada automaticamente).
2. Teste em homologação.
3. No GitHub, **Actions → Release - Gerar branch de produção → Run workflow**, informando a versão (ex.: `1.0.0`).
4. A branch `release/1.0.0` é criada a partir da `main` e dispara o deploy de produção.
5. Após validar em produção, faça merge de `release/1.0.0` de volta em `main` (e `develop`).

## Workflows

| Arquivo | Gatilho | Ação |
|---------|---------|------|
| `.github/workflows/ci.yml` | push/PR em develop/main | Build + testes backend e frontend |
| `.github/workflows/cd-backend.yml` | push develop/main + tag v* | Docker → GHCR → deploy Render (dev/hom/prod) |
| `.github/workflows/release.yml` | manual (workflow_dispatch) | Cria branch `release/<tag>` a partir da main |

## Observações

- O **Render free** "dorme" após ~15 min de inatividade e acorda na primeira requisição (pode demorar ~30s). Ideal para testes.
- O **frontend web** é o build do Expo (`react-native-web`). O app mobile (APK) continua sendo gerado localmente via `expo run:android`.
- Para o frontend web apontar para o backend correto por ambiente, adicione em `frontend/app.json` → `expo.extra`:
  ```json
  "extra": {
    "apiBaseUrlWeb": "https://saude-monitor-backend-dev.onrender.com"
  }
  ```
  (o `api.js` já lê `extra.apiBaseUrlWeb`; o app mobile usa `apiBaseUrlAndroid`/`apiBaseUrlIos`).
