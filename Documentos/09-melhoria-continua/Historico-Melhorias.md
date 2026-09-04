# 🔁 Histórico de Melhorias Aplicadas

> **Como funciona:** o Product Owner observa um comportamento a corrigir → a
> observação é registrada em [`skill-observations/`](../../skill-observations/) →
> a proposta de alteração vai para [`skill-updates/`](../../skill-updates/) → o PO
> decide → **o que efetivamente entrou é registrado aqui, com o PR**.
>
> Padrão adotado: *One Skill to Rule Them All*
> (https://github.com/rebelytics/one-skill-to-rule-them-all, CC BY 4.0).
>
> **Regra permanente:** toda alteração futura de processo ou de comportamento do
> agente ganha uma linha nesta tabela, com data, origem, PR e o efeito esperado.
> Sem a linha, a melhoria não está entregue.

---

## Índice de melhorias

| # | Data | Origem | O que mudou | PR | Estado |
|---|---|---|---|---|---|
| **M-001** | 02/09/2026 | [OBS-001](../../skill-observations/OBS-001-skill-pela-linguagem-do-arquivo.md) | Skill escolhida pela linguagem do arquivo, não pela proximidade da instalação: correção de backend chama `java`, não `expo-skills` | — (aplicada via #63) | ✅ Aplicada — registro reconstituído em 03/09/2026 |
| **M-002** | 03/09/2026 | [OBS-002](../../skill-observations/OBS-002-ativacao-de-skills-por-dominio.md) → [UPD-002](../../skill-updates/UPD-002-matriz-de-roteamento-de-skills.md) | Matriz de roteamento de skills por área + hook `SessionStart` que a injeta em toda sessão | #63 | ✅ Aplicada |
| **M-003** | 03/09/2026 | [OBS-003](../../skill-observations/OBS-003-skill-anunciada-nao-e-skill-ativada.md) → [UPD-003](../../skill-updates/UPD-003-portao-verificavel-e-escopo-de-skills.md) | Anunciar ≠ ativar; portão de `code-review` pulado em 3 PRs; `lobehub-react` sai da matriz de `frontend/` | #68 | 🟡 Parcial — item 1 aplicado, 2 e 3 dependem do PO |

---

## M-001 — Skill pela linguagem do arquivo (item 1 do Observer)

**Data do fato:** 02/09/2026 · **PR:** nenhum — ver "Por que não houve PR" abaixo ·
**Registro reconstituído em:** 03/09/2026

### Observação do PO

> "para as correções de back end não seria melhor chamar a skill de java ao invés
> da skill de expo?"

### Diagnóstico

O agente aplicava `expo-skills` também sobre correções de **backend** — Gradle +
Spring Boot 4.0.4 sobre Java 25. A skill `java` existia e era adequada, mas estava no
diretório **global**, enquanto `expo-skills` era a única instalada no diretório **do
projeto**. Proximidade venceu adequação. O `CLAUDE.md` da época pedia "o skill mais
adequado" sem dizer qual serve para qual parte do sistema.

### O que entrou

Nada de imediato — e é justamente esse o problema que o item 2 corrigiu. A regra só
virou artefato quando a matriz do [UPD-002](../../skill-updates/UPD-002-matriz-de-roteamento-de-skills.md)
foi criada, um dia depois:

| Onde a regra do item 1 vive hoje | O quê |
|---|---|
| `.claude/skills-roteamento.md`, linha `backend/` | `java` como skill obrigatória da área |
| `.claude/skills-roteamento.md`, seção "skills que NÃO se aplicam" | Bloqueia a variante do mesmo erro: ativar `quarkus` por semelhança de "backend Java" |

### Por que não houve PR

O item 1 aconteceu em 02/09; `skill-observations/`, `skill-updates/` e este histórico
nasceram em 03/09, no commit `3d2b9e6`. Verificado:
`git log --all -- CLAUDE.md .claude/` devolve **apenas os dois commits de 03/09**. O
item 1 não gerou PR nem commit — o `CLAUDE.md` da época era arquivo não versionado na
máquina do PO e foi sobrescrito pela reescrita do item 2.

### Proveniência

Reconstituído do banco local do claude-mem (`~/.claude-mem/claude-mem.db`):
`user_prompts#63` (a citação literal, 2026-09-02T23:25:33Z) e `observations#712-714`
(a decisão registrada e o inventário de skills que a fundamentou). Os 75 prompts do
histórico foram filtrados por `skill`, `CLAUDE.md` e `agente`: entre o início do
projeto e o item 2, o prompt #63 é a **única** correção do PO ao comportamento do
agente.

---

## M-002 — Roteamento de skills por área de atuação

**Data:** 03/09/2026 · **PR:** #63 · **Branch:** `feature/observer-roteamento-de-skills`

### Observação do PO

> "as skills não estão sendo ativadas conforme necessidade e área de atuação por
> demanda, ative mais de uma skill se necessário"

### Diagnóstico

O `CLAUDE.md` mandava delegar para "o agente/skill **mais adequado**" — no
singular — e não dizia qual skill serve para qual parte do sistema. Em um
repositório onde a tarefa típica cruza `backend/` e `frontend/` (o OPS-05 mexeu em
22 arquivos dos dois lados), isso produzia ativação única ou nenhuma. Pior: a
regra vivia só em documento, sem nenhum ponto do fluxo em que fosse cobrada.

### O que entrou

| Arquivo | Mudança |
|---|---|
| `.claude/skills-roteamento.md` | **Novo.** Matriz área → skills, os dois portões (`code-review` antes de todo PR; `security-review` em auth/dados pessoais) e a lista de skills que **não** se aplicam ao repositório |
| `.claude/hooks/roteamento-skills.js` | **Novo.** Lê a matriz e a injeta como `additionalContext` no `SessionStart` |
| `.claude/settings.json` | **Novo.** Declara o hook |
| `CLAUDE.md` | §2 e §3 reescritos: uma skill **por área tocada**, com anúncio antes da primeira edição. Ganhou as seções "Entrega" e "Melhoria contínua" |
| `.claude/CLAUDE.md` | Era cópia literal do `CLAUDE.md` da raiz e chegava **duplicado** ao contexto de toda sessão; reduzido a um ponteiro |
| `skill-observations/`, `skill-updates/` | **Novas.** Estrutura do ciclo de melhoria, com README e índice em cada uma |

> ### ⚠️ Atualização de 03/09/2026 — o que **não** foi versionado
>
> **Decisão do PO:** *"o que não for relevante para o desenvolvimento do sistema não
> deve ser mergeado, não deve subir para repositório remoto — skills, pasta `.claude`
> e etc."* Os arquivos `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/settings.json`,
> `.claude/hooks/roteamento-skills.js`, `.claude/skills-roteamento.md` e
> `.claude/skills/expo-skills/SKILL.md` são **configuração do agente**, não do
> sistema: não entram em build, imagem Docker ou bundle do Expo. Saíram do PR #63 e
> passaram para o `.gitignore`; vivem apenas na máquina do PO.
>
> A **documentação do processo** — este histórico, `skill-observations/` e
> `skill-updates/` — foi mantida por decisão expressa do PO.
>
> Para que a regra não dependa de uma máquina só (foi exatamente assim que o item 1
> se perdeu), a matriz está transcrita no **Anexo A**, no fim deste documento.

### Decisões de implementação

- **Node em vez de `jq`** no hook — `jq` não está no `PATH` das máquinas do
  projeto (verificado); `node` está, porque o frontend depende dele.
- **Falha em silêncio** se a matriz sumir: quebrar o início da sessão seria pior
  do que não injetar o contexto.
- **Fonte única** — a matriz mora em um arquivo só; `CLAUDE.md` aponta para ela em
  vez de repetir o conteúdo, para não recriar a duplicação que acabou de ser removida.

### Verificação

- *Pipe-test* do hook (`echo '{}' | node ...`): JSON válido, exit 0.
- `settings.json`: comando alcançável em `hooks.SessionStart[].hooks[].command`.
- `code-review` (severidade média) rodado sobre o próprio diff deste PR — o portão
  que a melhoria institui, aplicado a ela mesma. **1 achado no escopo**, corrigido no
  commit seguinte: o `$schema` do `settings.json` apontava para o *meta-schema* do
  JSON Schema (`json-schema.org/draft/2020-12/schema`) em vez do schema do Claude
  Code (`json.schemastore.org/claude-code-settings.json`) — o editor validaria o
  arquivo como se fosse um documento de schema, e erros de digitação em
  `hooks`/`SessionStart` (justamente o que o arquivo existe para declarar) passariam
  sem validação.
- O mesmo `code-review` levantou **3 achados fora do escopo deste PR**, no portão de
  cobertura que já entrou por #60 (`jest.setup-after-env.js`, `jest.config.js`,
  `PerfilScreen.test.js`). Não foram corrigidos aqui para não misturar tarefas —
  ver a seção **Pendências abertas** no fim deste documento.

### Pendência que depende do PO

O watcher de configuração só observa diretórios que já tinham arquivo de settings
no início da sessão. Como `.claude/settings.json` nasceu agora, **o hook passa a
valer a partir da próxima sessão** (ou após abrir `/hooks` uma vez). Nesta sessão a
regra foi seguida manualmente.

---

## M-003 — Anunciar não é ativar, e portão não rodado é portão inexistente

**Data:** 03/09/2026 · **PR:** #68

### Observação do PO

> "ative as skills necessarias para a conclusão das melhorias. Ate agora não vi
> nenhuma de java sendo ativada quando há modificação no backend. Esta seguindo o
> plano obrigatorio de CLAUDE.md?"

### Diagnóstico

Três respostas, e uma delas absolve o agente:

1. **A `java` não ter sido ativada estava correto.** Nenhum dos 9 commits da sessão
   tocou `backend/` — verificado um a um. A matriz define a área pelos arquivos do
   diff, e não houve `.java`.
2. **As skills foram anunciadas, não ativadas.** O agente escreveu "Ativando
   `expo-skills`" e "Ativando `software-architect`" sem invocar nenhuma.
3. **O portão de `code-review` foi pulado** nos PRs #64, #65 e #66.

### O padrão que apareceu quatro vezes no mesmo dia

| # | Onde | O sinal | A realidade |
|---|---|---|---|
| 1 | `keep-alive-backend.yml` | Documentado como mitigação ativa do E8-01 | Nunca executou — o `schedule` só roda a partir da branch padrão, e a API devolvia 404 |
| 2 | `De-Para` | E8-01 marcado 🟡 mitigado | A mitigação não existia |
| 3 | `cd-frontend.yml` | 36 execuções verdes | Nenhuma publicou: os segredos nunca existiram e a action encerra com código 0 |
| 4 | Transcript do agente | "Ativando `expo-skills`" | Zero invocações |

**Em todos, o sinal verde foi confundido com o resultado.** É o mesmo defeito de
raciocínio, em quatro superfícies diferentes.

### O custo, medido

O portão rodado retroativamente sobre #65 e #66 devolveu **8 achados, 2 de
severidade alta**, em código já mergeado — inclusive a constatação de que o PR que
existia para corrigir um falso-verde **não o corrigiu**: apenas escreveu um aviso ao
lado dele.

Na rodada seguinte, com o portão rodado **antes** do PR (#67), ele pegou um defeito
de correção que teria sido mergeado: o closure congelado da recursão do check-in
furava o guard de "visita ativa" e permitia abrir uma segunda visita com uma já
aberta.

### O que entrou

| Item | Estado |
|---|---|
| `lobehub-react` sai da coluna de `frontend/` e vai para "skills que NÃO se aplicam" — verificado que `@lobehub/ui`, antd, `antd-style`, Next.js e `react-router-dom` não existem no `package.json` | ✅ Aplicado **nos dois lugares**: na matriz viva `.claude/skills-roteamento.md` (local, não versionada) e no Anexo A versionado. Ver a ressalva no [UPD-003](../../skill-updates/UPD-003-portao-verificavel-e-escopo-de-skills.md) sobre o custo de a regra viver em dois arquivos |
| Trocar "anunciar" por "invocar" na redação da matriz | 🟡 Proposto |
| Hook `PreToolUse` que bloqueia `gh pr create` sem `code-review` na sessão | 🟡 Proposto — esbarra na decisão de não versionar `.claude/`; ver UPD-003 |

---

## Entregas de código desta sessão (03/09/2026)

Aplicação da regra "um PR por tarefa concluída". Dois commits estavam prontos na
branch local, sem PR e sem nunca terem sido enviados ao `origin`.

| PR | Estória | Escopo | Verificação local |
|---|---|---|---|
| [#61](https://github.com/GabrielVogado/saude-monitor/pull/61) | **E8-13** | ESLint 9 no frontend + correção de 2 defeitos de produção que ele achou (BUG-01 `SugestoesPendentesScreen`, BUG-02 `concluirFeedback`) | `npm run lint` → 0 erros, 18 avisos (no piso); `npm test` → 30 suítes, 245 testes |
| [#62](https://github.com/GabrielVogado/saude-monitor/pull/62) | **OPS-05** | Retry com backoff exponencial com jitter + fila offline para eventos de visita; campo `ocorridoEm` no contrato de check-in/checkout | Frontend idem #61; backend `VisitaServiceImplTest` → `BUILD SUCCESSFUL` |
| [#63](https://github.com/GabrielVogado/saude-monitor/pull/63) | **M-002** | Esta melhoria de processo | *Pipe-test* do hook + validação do `settings.json` |

> **#62 é empilhado sobre #61.** Os dois commits viviam na mesma branch local;
> foram separados para respeitar "um PR por tarefa". Após o merge de #61 o GitHub
> reaponta #62 para `develop` automaticamente.

---

### Correção da esteira do #61 (03/09/2026)

O job **Frontend (Expo Web)** do PR #61 falhava no `npm ci`, antes de chegar ao lint
ou aos testes: `Missing: @emnapi/core@1.11.3 from lock file`.

**Causa:** divergência de versão do npm entre a máquina de desenvolvimento e a
esteira — local `npm 11.6.1`, esteira `npm 10.8.2` (o `setup-node@v4` do workflow usa
`node-version: '20'`, que hoje entrega node 20.20.2 + npm 10.8.2). O
`eslint-config-expo`, que entrou nesse mesmo PR, arrasta
`unrs-resolver → @napi-rs/wasm-runtime@1.2.3`, um pacote *optional* que declara
`@emnapi/core` e `@emnapi/runtime` como **peerDependencies**. O npm 11 resolve esses
peers sem gravá-los no topo do lock; o npm 10.8.2 os exige lá. O lock gerado pelo npm
11 é válido para o npm 11 e inválido para o npm 10 — e a esteira roda o npm 10.

**Correção:** lock regerado com o próprio npm da esteira
(`npx npm@10.8.2 install --package-lock-only`). O diff é só metadado — entram as duas
entradas `@emnapi/*` que faltavam e ajustam-se flags `"peer"` — sem mudança de versão
ou de *integrity* de nenhum pacote já existente. Commit `007eea5`.

**Verificação** (a falha foi reproduzida localmente antes da correção):

| Comando | Antes | Depois |
|---|---|---|
| `npx npm@10.8.2 ci --dry-run` | `EUSAGE` — Missing @emnapi/core, @emnapi/runtime | `added 35 packages` |
| `npm ci --dry-run` (npm 11.6.1) | `added 33 packages` | `added 35 packages` |
| `npm run lint` | — | 0 erros, 18 avisos (no teto de `--max-warnings 18`) |
| `npm test` | — | 27 suítes, 207 testes, verdes |

O lock passou a servir **as duas versões de npm**, então não foi preciso mexer no
workflow. Fica registrada a armadilha: um `npm install` rodado com npm 11 volta a
remover essas entradas e quebra o `npm ci` de novo. Enquanto o workflow usar
`node-version: '20'`, regerar o lock com `npm@10.8.2`.

O mesmo lock foi levado para a branch do **#62** (merge `11224b7`), que é empilhado
sobre o #61 e quebraria do mesmo jeito assim que a esteira rodasse nele.

> **Nota de rastreabilidade (regra D-03):** este registro vive no PR #63, e não no
> #61, porque o próprio arquivo `Historico-Melhorias.md` nasce no #63 — ele ainda não
> existe no `develop`, então o #61 não teria onde escrever.

---

## Pendências abertas

| # | O que | Origem | Estado |
|---|---|---|---|
| **P-001** | ~~Reconstituir o **item 1** do Observer~~ — reconstituído em 03/09/2026 a partir do banco do claude-mem, com citação literal do PO. Ver [OBS-001](../../skill-observations/OBS-001-skill-pela-linguagem-do-arquivo.md) e M-001 acima. | PO | ✅ Fechada |
| **P-002** | ~~O hook `SessionStart` só passa a valer a partir da próxima sessão~~ — **confirmado funcionando em 03/09/2026**. A "próxima sessão" foi a desta data: a matriz de roteamento chegou injetada no contexto do agente e foi a base de todas as decisões de skill do dia. O watcher passou a observar o diretório depois que o `.claude/settings.json` existiu no início de uma sessão, exatamente como previsto. | UPD-002 | ✅ Fechada |
| **P-003** | ~~3 achados do `code-review` no portão de cobertura entregue por #60~~ — **fechados em 03/09/2026**. (a) `asyncUtilTimeout` de 5 s era igual ao `testTimeout` padrão do Jest, então a folga do `findBy*` nunca era usada e a falha vinha como `Exceeded timeout` opaco; `testTimeout` subiu para 15 s e a mensagem passou a ser a do testing-library, que diz qual elemento faltou. (b) `collectCoverageFrom` omitia o `App.js` — 191 linhas com a árvore de navegação e os listeners de notificação. **Não é ponto de entrada: é código de produção**, e essa é a razão de a exclusão estar errada. Medido: 46,87% de statements e **0% de branches**. ⚠️ **Correção de uma afirmação anterior deste próprio registro:** a primeira redação dizia que o `App.js` era "o arquivo menos coberto do projeto". É falso — `LoginScreen.js` está em **0%**, e `SugerirHospitalScreen` (2,85%), `RevisarSugestaoScreen` (3,03%), `UserScreen` (3,22%), `PrivacidadeScreen` (16,66%) e `GeofencingTaskService` (17,64%) também são piores. O `App.js` é o sétimo. O erro foi pego pelo `code-review` do próprio PR que fecha esta pendência — num PR cujo objetivo era aposentar um comentário factualmente errado. Com ele incluído, a cobertura honesta é 77,5% de statements contra os 78,13% que a exclusão mostrava. (c) O comentário do `PerfilScreen.test.js` errava duas vezes: dizia que "Dados e Privacidade" era o cabeçalho pintado durante o carregamento, quando o cabeçalho é "Perfil e Privacidade" e aquele texto é um título de card renderizado só depois do carregamento. | `code-review` de 03/09/2026 | ✅ Fechada |
| **P-004** | ~~O git-flow documentado não é o do repositório~~ — **corrigido em 03/09/2026**, por decisão do PO: *"corrigir para master"*. O fluxo passa a ser `feature/* → develop (dev) → master (produção)`, com `release/<tag>` como versão fixada; o degrau de homologação sai do documento porque não tem branch nem ambiente. Referências a `main` corrigidas em **5 workflows e 6 documentos**. A primeira redação deste registro dizia "13 referências em 5 workflows e 2 documentos" — contagem só dos workflows, e completude que não se sustentava: o `code-review` achou `main` vivo em mais três documentos correntes, incluindo o `Backlog-MVP-v2.1.md`, que o `CLAUDE.md` lista como leitura obrigatória de sessão. **Achado no caminho:** o `ci.yml` disparava em `[develop, main]` — como `main` nunca existiu, **nenhum push ou PR para a branch de produção rodava CI**. Uma promoção para produção não era validada por nada. Também entrou uma guarda de credencial no `cd-backend.yml`: sem os secrets do ambiente o deploy **falha com mensagem explícita**, em vez de ficar verde sem publicar — promoção para produção que não entrega é o pior caso do falso-verde. | Auditoria de PRs, 03/09/2026 | ✅ Fechada |
| **P-005** | ~~A branch `feature/e8-01-migracao-cloud-run` existe só na máquina local~~ — **encerrada em 03/09/2026 por decisão do PO:** *"Cloud Run não entra nesse escopo, delete."* A branch foi apagada (`d2aabc8`, 626 linhas: workflow `cd-backend-cloudrun.yml`, `deploy/cloudrun/`, `application.properties`, `De-Para`). Nunca chegou ao `origin`, então nada foi removido do repositório remoto. O commit sobrevive no reflog local por ~90 dias, recuperável com `git checkout d2aabc8`. **Consequência registrada:** com a Oracle Cloud inviável (São Paulo sem capacidade Always Free, região *home* imutável) e o Cloud Run fora de escopo, **o destino da migração fica em aberto** — o que mantém o **E8-02** bloqueado. **Uma linha do commit apagado pode valer resgate à parte:** `server.port=${PORT:8080}` no `application.properties`, que torna a porta configurável por variável de ambiente. Não é específica de Cloud Run — vários provedores injetam `PORT`. Não foi resgatada aqui porque alteraria o único caminho de deploy que hoje funciona (`dev` no Render) sem que este PR possa exercitá-lo. | PO | ✅ Fechada |
| **P-006** | Com `master` e `release/<tag>` mapeados para o mesmo ambiente `prod`, os dois usam o mesmo `RENDER_SERVICE_ID_PROD` mas publicam tags de imagem diferentes — e o `POST /v1/services/<id>/deploys` manda `{}`, redeployando a imagem em que o serviço está fixado, não a recém-construída. Consequência: `release/1.0.0` construiria a `:1.0.0` e o serviço subiria a `:prod` — a "versão fixada" nunca seria implantada. As saídas são passar `imageUrl` no corpo do POST ou usar service IDs separados; as duas mudam o único caminho de deploy que hoje funciona (`dev`), e este PR não pode exercitá-las porque o `paths: backend/**` impede o CD de rodar. **Resolver quando o ambiente de produção for criado.** ➕ **Segundo defeito no mesmo caminho, achado em 03/09/2026:** o `cd-backend.yml` filtra por `paths: backend/**`, e o `release.yml` cria a branch com `git checkout -b` + `git push`, **sem commit novo** — um push de criação de branch não carrega diff que case com `paths`, então **criar `release/1.0.0` não dispara o deploy de produção**. ⚠️ **Correção da causa, 03/09/2026:** a primeira redação culpava o filtro de `paths`. O motivo real é outro e mais profundo — o `release.yml` empurra a branch com o **`GITHUB_TOKEN`**, e a **regra de recursão** do GitHub não cria execução de workflow para push feito com esse token. Isso invalida a saída que este registro propunha: **um gatilho `create:` também não funcionaria**, pelo mesmo motivo — quem implementasse a partir da nota anterior construiria a correção, não veria nada disparar e teria de rediagnosticar do zero. As saídas reais são um PAT (ou token de GitHub App) no `release.yml`, ou disparar o deploy por `workflow_dispatch` a partir da branch de release. | `code-review` da P-004, 03/09/2026 | 🟡 Bloqueada até prod existir |
| **P-007** | Proteção de branch. ⚠️ **O estado real é pior do que a primeira redação dizia:** ela afirmava que só a `master` estava desprotegida. Verificado pela API em 03/09/2026: **`develop` e `master` estão ambas sem proteção e sem ruleset** — um PR com CI vermelho pode ser mergeado nas duas. O `De-Para` registrava desde 02/09 que a `develop` exigia os dois checks; a causa provável do sumiço é o repositório ter sido tornado **privado** por alguns minutos em 03/09 (proteção de branch não existe em repositório privado no plano Free, e voltar a público não restaura). O portão que o E8-12 entregou está desligado, e a documentação afirmava o contrário — corrigido. **Entregue para resolver:** os rulesets versionados em [`.github/rulesets/`](../../.github/rulesets/), importáveis em Settings → Rules → Rulesets → Import. Faltam dois passos que o import não faz: adicionar o bypass de administrador (se desejado) e conferir que os nomes dos checks batem com os jobs do `ci.yml`. | `code-review` da P-004, 03/09/2026 | 🟡 Ação do PO |

---

## Anexo A — Matriz de roteamento de skills (transcrição)

> O arquivo operacional é `.claude/skills-roteamento.md`, que **não é versionado**
> (ver a atualização de 03/09/2026 na seção M-002). Esta transcrição existe para que
> a regra sobreviva à perda da máquina — a lição do item 1.

**Regra:** ativar **uma skill por área tocada pela tarefa — não uma por tarefa**. A
área é determinada pelos arquivos que a tarefa vai tocar, não pelo assunto da frase
do usuário.

| Área tocada | Skills obrigatórias | Complementares |
|---|---|---|
| `backend/` — Spring Boot 4, Java 25, MongoDB | `java` | `software-architect` (mudança estrutural ou novo ADR) · `security-review` (autenticação, JWT, LGPD, endpoint público) |
| `frontend/` — Expo 55, React Native, `react-native-web` | `expo-skills` | `run` (confirmar na tela real) |
| `deploy/`, `.github/workflows/`, `render.yaml` | `software-architect` | `update-config` |
| `Documentos/` | — | `software-architect` (decisão arquitetural, ADR, De-Para) |
| `.claude/`, `CLAUDE.md`, hooks, permissões | `update-config` | `fewer-permission-prompts` · `claude-automation-recommender` |
| Gráfico, painel ou relatório visual | `dataviz` | — |
| Integração com LLM / API Claude | `claude-api` | — |

**Portões, independentes da área:**

- Antes de abrir qualquer PR: `code-review` sobre o diff.
- Se o diff toca autenticação, tokens, dados pessoais ou endpoint público: `security-review`.

**Skills que NÃO se aplicam a este repositório:**

- `quarkus` — o backend é **Spring Boot 4**, não Quarkus. Não ativar por semelhança de "backend Java".
- `awesome-llm-apps-fullstack-developer` — o produto não tem camada de LLM.
- `lobehub-react` — **removida da coluna de `frontend/` em 03/09/2026** ([OBS-003](../../skill-observations/OBS-003-skill-anunciada-nao-e-skill-ativada.md)). O conteúdo dela é `@lobehub/ui`, antd, Next.js App Router e `react-router-dom`; verificado no `package.json` que **nenhuma das cinco existe**. O projeto é Expo/React Native com React Navigation e componentes próprios (`CS*`).
