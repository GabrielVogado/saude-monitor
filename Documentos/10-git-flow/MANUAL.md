# 📘 Manual de Funcionamento — Clinical Sanctuary

Manual operacional do sistema de monitoramento hospitalar por geolocalização, cobrindo o fluxo de desenvolvimento, os ambientes, o CI/CD e o processo de release.

> **Revisão 22/09/2026 — ambiente de homologação.** `master` deixou de ser produção e
> passou a ser **homologação (HML)**: cada push nela publica o backend
> `saude-monitor-backend-hom`, gera o APK "Radar Saúde HML" e cria a tag
> `vX.Y.Z-rc.N` com uma GitHub Release. Produção fica para `release/<tag>`. O backend
> está no **Google Cloud Run** desde 04/09/2026 — as menções ao Render abaixo que não
> foram reescritas descrevem o caminho de rollback, não o vigente. Versão anterior
> deste manual: histórico do git.

---

## 1. Visão Geral

O **Clinical Sanctuary** detecta automaticamente a entrada e saída de usuários em áreas hospitalares (geofence), registra o tempo de permanência e coleta feedback pós-atendimento. O sistema é composto por:

- **Backend:** Spring Boot 4 (Java 25) + MongoDB, empacotado em Docker.
- **Frontend:** React Native / Expo 55 (web via `react-native-web` + APK mobile).
- **CI/CD:** GitHub Actions + Google Cloud Run (backend) + Gradle no Actions (APK) + GitHub Releases (APK de homologação) + EAS (AAB de loja) + MongoDB Atlas (banco). **O frontend web não tem provedor de publicação** — ver §4.1.

---

## 2. Ambientes

Cada ambiente tem backend, banco, `JWT_SECRET` e APK próprios.

| Ambiente | Branch | Backend (Cloud Run) | Banco (Atlas) | APK |
|----------|--------|---------------------|---------------|-----|
| **dev** (desenvolvimento) | `develop` | `saude-monitor-backend-dev` | `saude_monitor_dev` | "Radar Saúde DEV" (`…saudemonitor.dev`), artefato do Actions (30 dias) |
| **hom** (homologação) | `master` | `saude-monitor-backend-hom` | `saude_monitor_hom` | "Radar Saúde HML" (`…saudemonitor.hom`), **GitHub Release** por tag `vX.Y.Z-rc.N` |
| **prod** (produção) | `release/<tag>` | `saude-monitor-backend` ⚠️ *não criado* | `saude_monitor_prod` ⚠️ *não criado* | "Radar Saúde" (`…saudemonitor`) — loja, a definir |

> **Regra de ouro:** cada ambiente usa **banco de dados separado** e **JWT_SECRET diferente**. Nunca compartilhe dados entre ambientes.

DEV e HML são pacotes diferentes: os dois apps convivem no mesmo celular. Dentro de
cada um, um APK novo **instala por cima** do anterior (mesma chave de release,
`versionCode` maior) — ver [`deploy/android/README.md`](../../deploy/android/README.md).

---

## 3. Fluxo de Desenvolvimento (Gitflow)

```
feature/* ──► develop ──► master ──► release/<tag>
 (trabalho)      (dev)      (hom)     (prod, versão fixada)
                            tag vX.Y.Z-rc.N + GitHub Release com o APK HML
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

### 3.3 Promoção para homologação
1. (Opcional) Se a entrega muda a versão, suba `expo.version` em `frontend/app.json`
   num PR para a `develop` antes da promoção. É dele que sai o `X.Y.Z` da tag.
2. Abra um **Pull Request** de `develop` → `master`. **Só de `develop`:** o check
   `Origem do PR (master)` reprova qualquer outra origem. Um PR de feature direto para
   homologação pularia a integração — ninguém teria visto aquele código conviver com
   o resto antes de ser homologado.
3. O CI roda no PR (desde 03/09/2026 — antes disso `master` não tinha CI nenhuma).

> ⚠️ **Nem `develop` nem `master` estão protegidas hoje** (verificado pela API em
> 03/09/2026 — sem proteção clássica e sem ruleset). A `develop` teve proteção a partir
> de 02/09, mas ela sumiu quando o repositório foi tornado privado por alguns minutos:
> proteção de branch não existe em repositório privado no plano Free, e voltar a
> público **não restaura**.
>
> Enquanto isso, **um PR com CI vermelho pode ser mergeado nas duas branches**.
>
> **Regras da `master`, decididas em 03/09/2026:** só aceita PR vindo da `develop`, e
> só o dono do repositório pode mergear.
>
> A restrição de origem não existe como regra nativa — virou o check
> `Origem do PR (master)`. Já a exclusividade do merge **não precisou de regra**: o
> repositório é pessoal e tem um único colaborador, então ninguém mais tem acesso de
> escrita. Exigir aprovação foi cogitado e descartado: o GitHub não deixa o autor
> aprovar o próprio PR, então, com um desenvolvedor só, isso deixaria a `master`
> impossível de mergear sem acionar o bypass a cada promoção — atrito com aparência de
> rigor. Se um colaborador for adicionado, a exigência passa a fazer sentido; o
> [README dos rulesets](../../.github/rulesets/README.md) registra o que mudar.
>
> Os rulesets para reimportar estão versionados em
> [`.github/rulesets/`](../../.github/rulesets/) — importar em
> *Settings → Rules → Rulesets → New ruleset → Import a ruleset*. Ver o README de lá
> para os dois passos que o import não faz sozinho.
4. Após o merge, o **`cd-homologacao.yml`** roda sozinho, nesta ordem, e para no
   primeiro erro:
   1. calcula a próxima `vX.Y.Z-rc.N` (recusa versão menor que a última homologada);
   2. gera o APK HML — primeiro, porque é a etapa que mais falha, e falhar aqui não
      toca no ambiente;
   3. publica `saude-monitor-backend-hom` e roda os 3 smoke tests (saúde, leitura do
      Mongo, filtro por raio);
   4. confere que a URL embutida no APK responde e cria a tag e a **GitHub Release**
      (pré-release) com o APK e o changelog desde a rc anterior.

   Merges muito seguidos: o GitHub guarda só uma execução na fila, então um commit
   intermediário pode ficar sem rc própria — o seguinte o contém.
5. Testadores baixam o APK na página **Releases** do repositório. Quem já tem o HML
   instalado só instala por cima.

> ⚠️ **Pré-requisitos (uma vez):** a chave de release do APK
> ([`deploy/android/README.md`](../../deploy/android/README.md)), o banco/usuário
> `saude_monitor_hom` no Atlas (§5.1) e os secrets `_HOM` no Google Cloud
> (`bash deploy/google/setup-homologacao.sh`). Sem eles o `cd-homologacao.yml` falha
> com mensagem explícita, e nenhuma tag é criada.

### 3.4 Release de produção
1. Valide em **homologação** (`master`, a última `vX.Y.Z-rc.N`) antes de fixar a versão.
2. No GitHub: **Actions → Release - Gerar branch de produção → Run workflow**, informando a **rc validada** (ex.: `v1.0.0-rc.3`).
3. O workflow cria a branch **`release/1.0.0`** a partir **dessa tag** — não da ponta da `master`, que pode já ter commits ainda não homologados.
4. O push da branch `release/1.0.0` dispara o deploy do **ambiente prod**.
5. Após validar em produção, faça merge de `release/1.0.0` de volta em `master` (e `develop`).

---

## 4. CI/CD

### 4.1 Workflows

| Workflow | Gatilho | Ação |
|----------|---------|------|
| `ci.yml` | push/PR em `develop`/`master` | Build + testes do backend e frontend |
| `cd-backend-google.yml` | push em `develop`, `release/**` (caminho `backend/**`) + manual + `workflow_call` | Docker → Artifact Registry → deploy no **Cloud Run** + 3 smoke tests. **Falha com mensagem explícita** se o ambiente não tiver secrets |
| `cd-homologacao.yml` | push em `master` + manual | **Homologação:** versão `vX.Y.Z-rc.N` → backend HML → APK HML → tag + GitHub Release (§3.3) |
| `cd-mobile-apk.yml` | push em `develop` (caminho `frontend/**`) + manual + `workflow_call` | Build do APK com Gradle no próprio Actions. Artefato do run (30 dias). Pacote, nome e versão por ambiente |
| `cd-backend-render.yml` | só manual | Rollback para o Render (desativado desde 04/09/2026) |
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

| Branch | Ambiente | Serviço Cloud Run | Sufixo dos secrets GCP | Tag da imagem |
|--------|----------|-------------------|------------------------|---------------|
| `develop` | `dev` | `saude-monitor-backend-dev` | *(nenhum)* | `dev` |
| `master` | `hom` | `saude-monitor-backend-hom` | `_HOM` | `hom` |
| `release/<tag>` | `prod` | `saude-monitor-backend` | `_PROD` | `<tag>` (ex.: `1.0.0`) |

### 4.3 Secrets do GitHub

Credenciais do backend **não** ficam no GitHub: estão no Secret Manager do Google
Cloud (`MONGO_URI`, `JWT_SECRET`, `RESEND_API_KEY`, com o sufixo da tabela acima), e o
Actions se autentica por Workload Identity Federation, sem chave. No GitHub:

| Secret | Descrição |
|--------|-----------|
| `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_STORE_PASSWORD`, `ANDROID_RELEASE_KEY_ALIAS`, `ANDROID_RELEASE_KEY_PASSWORD` | Chave de release do APK. Obrigatórios para homologação — ver [`deploy/android/README.md`](../../deploy/android/README.md) |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Token público do Mapbox embutido no APK |
| `RENDER_API_KEY_DEV`, `RENDER_SERVICE_ID_DEV` | Só para o rollback manual do Render |

---

## 5. Deploy Manual (primeira configuração)

### 5.1 MongoDB Atlas
1. Crie um cluster **M0** (free tier).
2. Crie um usuário com senha.
3. Libere o IP `0.0.0.0/0` (ou o IP do Render).
4. Crie os bancos por ambiente: `saude_monitor_dev` (existe), `saude_monitor_hom`
   (homologação) e, quando houver produção, `saude_monitor_prod`.
5. **Um usuário por ambiente**, com papel `readWrite` **só** no banco dele
   (*Database Access → Add New Database User → Specific Privileges*). Assim a URI de
   homologação não consegue ler nem apagar dados de dev, mesmo por engano.
6. A URI de cada ambiente termina no banco dele
   (`mongodb+srv://saude_monitor_hom:<senha>@<cluster>/saude_monitor_hom?...`) e vai
   para o Secret Manager — para homologação, com `bash deploy/google/setup-homologacao.sh`.

> O banco de homologação nasce vazio; na primeira subida o backend importa os
> estabelecimentos (seed de hospitais, que só roda com a coleção vazia).

### 5.2 Google Cloud Run (backend)
O projeto, a federação de identidade e o Artifact Registry já existem
([`deploy/google/README.md`](../../deploy/google/README.md)). Por ambiente, só falta
criar os secrets — o serviço nasce no primeiro deploy:

- **Homologação:** `bash deploy/google/setup-homologacao.sh` (cria `MONGO_URI_HOM`,
  gera `JWT_SECRET_HOM` aleatório e cria `RESEND_API_KEY_HOM`).
- **Produção:** o mesmo, com `_PROD`, quando for criada.

O Render ficou só como rollback manual (`cd-backend-render.yml`).

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
