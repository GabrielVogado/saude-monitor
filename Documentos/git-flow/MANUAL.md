# 📘 Manual de Funcionamento — Clinical Sanctuary

Manual operacional do sistema de monitoramento hospitalar por geolocalização, cobrindo o fluxo de desenvolvimento, os ambientes, o CI/CD e o processo de release.

---

## 1. Visão Geral

O **Clinical Sanctuary** detecta automaticamente a entrada e saída de usuários em áreas hospitalares (geofence), registra o tempo de permanência e coleta feedback pós-atendimento. O sistema é composto por:

- **Backend:** Spring Boot 4 (Java 25) + MongoDB, empacotado em Docker.
- **Frontend:** React Native / Expo 55 (web via `react-native-web` + APK mobile).
- **CI/CD:** GitHub Actions + Render (backend) + Gradle no Actions (APK) + EAS (AAB de loja) + MongoDB Atlas (banco). **O frontend web não tem provedor de publicação** — ver §4.1.

---

## 2. Ambientes

O projeto prevê ambientes isolados por branch, cada um com seu próprio backend e banco. **Hoje só o `dev` existe** — os demais entram quando forem criados.

| Ambiente | Branch | Backend (Render) | Frontend web | Banco (Atlas) |
|----------|--------|------------------|--------------------|---------------|
| **dev** (desenvolvimento) | `develop` | `saude-monitor-backend-dev` | — (sem provedor) | `saude_monitor_dev` |
| **prod** (produção) | `master` · `release/<tag>` | `saude-monitor-backend-prod` ⚠️ *não criado* | — (sem provedor) | `saude_monitor_prod` ⚠️ *não criado* |

> ⚠️ **Só o ambiente `dev` existe hoje.** O `saude-monitor-backend-dev` é o único Web
> Service no Render, e é o único com secrets configurados. Homologação deixou de ser
> um degrau do fluxo porque não tem branch nem ambiente — ela volta ao documento
> quando for criada.

> **Regra de ouro:** cada ambiente usa **banco de dados separado** e **JWT_SECRET diferente**. Nunca compartilhe dados entre ambientes.

---

## 3. Fluxo de Desenvolvimento (Gitflow)

```
feature/* ──► develop ──► master ──► release/<tag>
 (trabalho)      (dev)      (prod)    (prod, versão fixada)
```

### 3.1 Nova funcionalidade
1. Crie a branch a partir de `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/<nome-da-feature>
   ```
2. Desenvolva e commite.
3. Abra um **Pull Request** para `develop`.
4. Após merge, o CI roda e o **ambiente dev** é atualizado automaticamente.

### 3.2 Correção de bug em funcionalidade já entregue
1. Crie a branch a partir de `develop`:
   ```bash
   git checkout -b hotfix/<nome-do-fix>
   ```
2. Desenvolva, commite e abra PR para `develop`.

### 3.3 Promoção para produção
1. Abra um **Pull Request** de `develop` → `master`. **Só de `develop`:** o check
   `Origem do PR (master)` reprova qualquer outra origem. `master` é produção, e um PR
   de feature direto para lá pularia a integração — ninguém teria visto aquele código
   conviver com o resto antes de ir ao ar.
2. O CI roda no PR (desde 03/09/2026 — antes disso `master` não tinha CI nenhuma).

> ⚠️ **Nem `develop` nem `master` estão protegidas hoje** (verificado pela API em
> 03/09/2026 — sem proteção clássica e sem ruleset). A `develop` teve proteção a partir
> de 02/09, mas ela sumiu quando o repositório foi tornado privado por alguns minutos:
> proteção de branch não existe em repositório privado no plano Free, e voltar a
> público **não restaura**.
>
> Enquanto isso, **um PR com CI vermelho pode ser mergeado nas duas branches**.
>
> **Regras da `master`, decididas em 03/09/2026:** exige aprovação do PO e só aceita PR
> vindo da `develop`. A segunda não existe como regra nativa — virou o check
> `Origem do PR (master)`. A primeira tem uma ressalva importante: o GitHub não deixa o
> autor aprovar o próprio PR, então, com um desenvolvedor só, a exigência **depende do
> bypass de administrador** para que a `master` continue mergeável. O efeito real é
> transformar a promoção em ato deliberado, não em portão guardado por terceiro.
>
> Os rulesets para reimportar estão versionados em
> [`.github/rulesets/`](../../.github/rulesets/) — importar em
> *Settings → Rules → Rulesets → New ruleset → Import a ruleset*. Ver o README de lá
> para os dois passos que o import não faz sozinho.
3. Após merge, o **ambiente prod** é atualizado automaticamente.

> ⚠️ **Hoje isso falha de propósito.** O ambiente de produção não existe e os secrets
> `RENDER_API_KEY_PROD` / `RENDER_SERVICE_ID_PROD` não estão configurados; o
> `cd-backend.yml` interrompe o deploy com mensagem explícita em vez de ficar verde
> sem publicar. Criar o Web Service e os secrets é o que destrava a promoção.

### 3.4 Release de produção
1. Valide em **produção contínua** (`master`) antes de fixar a versão.
2. No GitHub: **Actions → Release - Gerar branch de produção → Run workflow**, informando a versão (ex.: `1.0.0`).
3. O workflow cria a branch **`release/1.0.0`** a partir da `master`.
4. O push da branch `release/1.0.0` dispara o deploy do **ambiente prod**.
5. Após validar em produção, faça merge de `release/1.0.0` de volta em `master` (e `develop`).

---

## 4. CI/CD

### 4.1 Workflows

| Workflow | Gatilho | Ação |
|----------|---------|------|
| `ci.yml` | push/PR em `develop`/`master` | Build + testes do backend e frontend |
| `cd-backend.yml` | push em `develop`, `master`, `release/**` (caminho `backend/**`) | Docker → GHCR → deploy Render. **Falha com mensagem explícita** se o ambiente não tiver secrets |
| `cd-mobile-apk.yml` | push em `develop`/`master` (caminho `frontend/**`) **+ manual** | Build do **APK interno** com Gradle no próprio Actions. Publica o APK como artefato do run (30 dias) |
| `cd-mobile-eas.yml` | **só manual** (`workflow_dispatch`, a partir de `release/*`) | Build do **AAB de loja** no EAS |
| `keep-alive-backend.yml` | cron a cada 10 min, 07h–22h + manual | Ping em `/actuator/health` para impedir a hibernação do Render (E8-01) |
| `release.yml` | manual (workflow_dispatch) | Cria branch `release/<tag>` a partir da `master` |

> **Removidas em 03/09/2026** (PR de limpeza de esteiras mortas):
>
> - `cd-frontend.yml` — publicava no Netlify, mas os segredos `NETLIFY_*` nunca
>   existiram: a action encerrava com código 0 e o job ficava verde **sem publicar
>   nada**, em 36 execuções. O único passo com valor, `npx expo export --platform web`,
>   **já é executado pelo `ci.yml`**. Quando houver provedor de publicação para o
>   frontend web, a esteira é reescrita para ele.
> - `cd-backend-oracle.yml` — zero execuções desde a criação. Fazia deploy por SSH
>   numa VM Oracle Cloud que não existe: São Paulo está sem capacidade Always Free, e
>   a migração está parada por decisão do PO.

> ### Por que o APK saiu do EAS (03/09/2026)
>
> O `cd-mobile-eas.yml` disparava a **cada push** em `frontend/**`. Foram **18 builds
> em agosto e 20 nos três primeiros dias de setembro**, contra os **30/mês** do free
> tier — a cota foi consumida por builds automáticos que ninguém pediu, e o projeto
> ficou sem conseguir gerar APK.
>
> O projeto não precisa do EAS para isso: `frontend/android/` está versionado por
> inteiro e o repositório é **público**, então minutos de Actions são gratuitos e
> ilimitados. O `cd-mobile-apk.yml` constrói com Gradle e roda **automaticamente** em
> `develop` e `master` (ver a decisão logo abaixo), além do disparo manual. Validado
> antes do merge: 21 min 13 s, APK de 23 MB.
>
> O EAS ficou com o **AAB de loja** em `release/<tag>`, que é raro e é onde os créditos
> rendem.
>
> **Decisão de 03/09/2026:** o EAS ficou **só manual**, e o APK do Gradle ficou
> **automático** em `develop` e `master`. A divisão é por custo: publicar na loja é ato
> deliberado e consome crédito; um APK de teste não custa nada e é mais útil pronto.
>
> Isso também eliminou uma armadilha que um gatilho em `release/**` teria, e cuja causa
> real só apareceu na segunda passada do `code-review`: o `release.yml` faz checkout com
> `actions/checkout@v4` e empurra a branch com o **`GITHUB_TOKEN`** — e a **regra de
> recursão** do GitHub não cria execução de workflow nenhuma para push feito com esse
> token. Não é questão de filtro de `paths` nem de a branch nascer sem commit:
> **nada dispararia**, e o silêncio pareceria normal. Sem gatilho automático, ninguém
> fica esperando por um disparo que não vem.
>
> ⚠️ **Precondição para o APK automático ser confortável:** o secret
> `ANDROID_KEYSTORE_BASE64`. Sem ele cada build gera uma keystore nova, e instalar um
> APK por cima do anterior falha com "app não instalado" — o testador desinstala e
> perde login, `dispositivoId` e feedback pendente. Automatizar sem o secret entrega
> esse incômodo com mais frequência. O nome do artefato avisa quando é o caso
> (`-ASSINATURA-EFEMERA`).
>
> ⚠️ **O `cd-backend.yml` ainda tem essa armadilha** (`paths: backend/**`): criar
> `release/1.0.0` também não dispara o deploy de produção. Não foi corrigido aqui porque
> remover o filtro faria o backend reconstruir a cada push em `develop`. Registrado na
> **P-006**, junto da colisão de tag de imagem — as duas se resolvem quando o ambiente de
> produção for criado.
>
> **Assinatura:** a variante `release` assina com `signingConfigs.debug`, e o
> `debug.keystore` não é versionado (`.gitignore`: `*.keystore`). O workflow usa o
> secret `ANDROID_KEYSTORE_BASE64` quando existir; sem ele, gera uma keystore e avisa
> no resumo do job que a chave muda a cada execução — APKs de runs diferentes não se
> atualizam entre si, é preciso desinstalar antes.

### 4.2 Mapeamento de ambiente (lógica do `resolve-env`)

| Branch | Ambiente | Tag da imagem GHCR |
|--------|----------|--------------------|
| `develop` | `dev` | `dev` |
| `master` | `prod` | `prod` |
| `release/<tag>` | `prod` | `<tag>` (ex.: `1.0.0`) |

### 4.3 Secrets do GitHub

Cada secret tem sufixo por ambiente (`_DEV`, `_PROD`):

| Secret | Descrição |
|--------|-----------|
| `RENDER_API_KEY_DEV/PROD` | API Key do Render. O sufixo `_HOM` saiu na P-004: o `resolve-env` só emite `dev` ou `prod`, então um secret `_HOM` nunca seria lido |
| `RENDER_SERVICE_ID_DEV/PROD` | ID do serviço do backend no Render. Hoje só `_DEV` está configurado |

---

## 5. Deploy Manual (primeira configuração)

### 5.1 MongoDB Atlas
1. Crie um cluster **M0** (free tier).
2. Crie um usuário com senha.
3. Libere o IP `0.0.0.0/0` (ou o IP do Render).
4. Crie os bancos por ambiente. Hoje existe apenas o `saude_monitor_dev`; `saude_monitor_prod` entra quando produção for criada.

### 5.2 Render (backend)
1. Crie um Web Service por ambiente, apontando para as imagens GHCR (`:dev`, `:prod`, `:<tag>`). Hoje existe apenas o de `dev`.
2. Configure as variáveis de ambiente (ver `backend/.env.example`).
3. Anote os **Service IDs**.

### 5.3 Frontend web — sem provedor definido

Não há hospedagem configurada para o frontend web. O `ci.yml` valida que o
`npx expo export --platform web` continua funcionando, mas o artefato não é
publicado em lugar nenhum. A distribuição hoje é o **APK**, gerado pelo
`cd-mobile-apk.yml`, com Gradle no próprio GitHub Actions — sem cota do EAS.

### 5.4 Variáveis de ambiente do backend

| Variável | Descrição |
|----------|-----------|
| `MONGO_HOST` | Host do cluster Atlas |
| `MONGO_PORT` | Porta (27017) |
| `MONGO_DATABASE` | Banco do ambiente (ex.: `saude_monitor_prod`) |
| `MONGO_AUTH_DB` | Banco de autenticação (admin) |
| `MONGO_USER` | Usuário do Atlas |
| `MONGO_PASSWORD` | Senha do Atlas |
| `JWT_SECRET` | Chave aleatória ≥ 32 bytes (**diferente por ambiente**) |
| `ADMIN_EMAIL` | E-mail do admin inicial |
| `ADMIN_SENHA` | Senha do admin inicial |
| `APP_SEED_ENABLED` | `false` em produção |

---

## 6. Testes

### 6.1 Backend
```bash
cd backend
./gradlew build
```

### 6.2 Frontend
```bash
cd frontend
npm ci
npm run typecheck
npx expo export --platform web
```

### 6.3 Teste manual do Épico 2 (check-in/checkout)
Com o backend de pé, use a API:
```bash
# Check-in (ponto dentro do geofence)
curl -X POST http://localhost:8080/api/v1/visitas/checkin \
  -H "Content-Type: application/json" \
  -d '{"hospitalId":"<ID>","origem":"GEOFENCE","posicao":{"type":"Point","coordinates":[-48.1211,-15.8251]},"dispositivoId":"teste-001"}'

# Checkout
curl -X POST http://localhost:8080/api/v1/visitas/<ID>/checkout \
  -H "Content-Type: application/json" \
  -d '{"posicao":{"type":"Point","coordinates":[-48.1211,-15.8251]}}'
```

---

## 7. Observações

- O **Render free** "dorme" após ~15 min de inatividade e acorda na primeira requisição (~30s).
- O **frontend web** é o build do Expo. O **APK mobile** sai do `cd-mobile-apk.yml` (Actions, manual) ou, localmente, de `npm run build:apk` / `expo run:android --variant release`.
- Para o frontend web apontar para o backend correto, configure `expo.extra.apiBaseUrlWeb` em `frontend/app.json` (o `api.js` já lê essa variável).
