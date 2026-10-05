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
| **M-004** | 04/09/2026 | Observação direta do PO (§ M-004) | Régua de 90% para **todo** o frontend + validação por mutação como parte de escrever teste + piso do `coverageThreshold` sobe a cada onda (70/58/65/70 → 78/66/76/79 → 79/67/77/80 → 90) | (Onda 1) | ✅ Aplicada |
| **M-005** | 06/09/2026 | BUG-07, relatado pelo PO em uso real | Smoke test de deploy que exercita a rota geoespacial: o portão antigo batia num `find()` sem índice e aprovou um deploy com a F-07 devolvendo HTTP 500 | (este PR) | ✅ Aplicada |
| **M-006** | 06/09/2026 | BUG-08, relatado pelo PO em uso real | Validação de servidor alimentada por dado do próprio cliente não valida nada + configuração que não migra o dado já gravado não corrige nada | (este PR) | ✅ Aplicada |
| **M-007** | 06/09/2026 | `code-review` sobre o PR #85 (achados suplementares) | Migração/reconciliador que faz *read-modify-write* do documento inteiro perde edição administrativa concorrente; corrigido para update parcial atômico tocando só os campos da migração | #85 | ✅ Aplicada |
| **M-008** | 08/09/2026 | Auditoria de código morto/lógica ambígua/erros silenciosos (pedido direto do PO) | 4 erros silenciosos críticos de auth/LGPD corrigidos: cadastro duplicado "com sucesso" (201), logout que mascarava falha real de revogação, seed de admin com senha vazia sem aviso, exclusão de conta afirmando remover uma coleção nunca escrita | #98 | ✅ Aplicada |
| **M-009** | 08/09/2026 | Auditoria de código morto/lógica ambígua/erros silenciosos (pedido direto do PO), mesmo pedido do M-008 | 5 bugs de comportamento do frontend corrigidos: geofencing nativo não parava no logout/exclusão de conta; botão "Sair" do Perfil nunca revogava o refresh token no servidor; notificação de feedback abria o formulário mesmo vencido (RN-09) — e, achado do `code-review` deste mesmo PR, também abria com dados da visita errada quando a pendência já tinha sido substituída; link "Esqueci minha senha" e botão "Voltar" do cadastro sem `onPress`; telas de moderação de sugestões inacessíveis removidas | #100 | ✅ Aplicada |
| **M-010** | 08–09/09/2026 | Pedido direto do PO: verificar se a base cobre "todos os hospitais existentes" | 1 hospital público ausente da rede SES-DF adicionado (Instituto de Cardiologia e Transplantes do DF; 340 → 341). O PR #103 fechado sem merge ao interpretar o pedido de forma ampla (importar 58 privados) — escopo só rede pública; normalização compartilhada extraída do pipeline | #104 | ✅ Aplicada |
| **M-011** | 09/09/2026 | Bug relatado pelo PO em uso real (UBS 05 do Recanto das Emas ausente no mapa com "Todos") | Listagem sem filtro geoespacial (mapa "Todos" e aba Hospitais) truncava em 100/20 hospitais por chamada, sem `Sort` estável — de 340 hospitais ativos, até 240 nunca apareciam no mapa e 320 nunca na lista sem busca por nome. Corrigido: `Sort` estável (nome + id) no backend, paginação completa no mapa e scroll infinito com guard de geração/reentrância na aba Hospitais **e** no Ranking (mesma falha pré-existente, achado do `code-review` deste PR) | #105 | ✅ Aplicada |
| **M-012** | 10/09/2026 | Pedido direto do PO: "Esqueci minha senha" — o link existia sem `onPress` e foi removido em 08/09 até virar estória própria | Recuperação de senha por código de 6 dígitos (OTP): `esqueci-senha`/`redefinir-senha` sob o rate limit de `/api/v1/auth/**` já existente, token hasheado (BCrypt) com TTL 15 min, reset invalida refresh tokens anteriores, tela `EsqueciSenhaScreen`; infraestrutura de e-mail criada do zero (Resend, `@Async`). 4 achados reais do `code-review` aplicados: corrida no upsert, canal lateral de tempo, corrida no contador, precisão do `iat` | #110 | ✅ Aplicada |
| **M-013** | 10/09/2026 | Lacuna identificada pelo PO na feature de recuperação de senha (#110) | Confirmação obrigatória de e-mail no cadastro: sem verificar, um endereço com erro de digitação ou inexistente nunca recebe o código de "esqueci minha senha" e a conta fica sem recuperação. `POST /auth/registro` passa a enviar código de 6 dígitos (reaproveitando a infra de OTP generalizada), `login` recusa (403 `EMAIL_NAO_CONFIRMADO`) até a confirmação, backfill migra contas antigas para `emailVerificado=true`, tela `ConfirmarEmailScreen` guia o usuário | (este PR) | ✅ Aplicada |
| **M-014** | 16/09/2026 | Descoberto ao testar os fluxos ao vivo no Expo Web para uma tarefa de documentação (não relatado antes) | Mapa (`GeoLocalizacaoScreen`) e Detalhe do Hospital quebravam com tela preta na Web desde a migração Mapbox: `@rnmapbox/maps` é nativo, sem build Web, e os componentes chegavam `undefined`. Módulo `utils/mapkit` reexporta o SDK nativo no mobile e, via `index.web.js`, implementa o mesmo subconjunto de API com `mapbox-gl` (já dependência não usada) na Web — geofences, marcadores e o seletor de sobreposição (BUG-11) voltam a funcionar no navegador | #117 | ✅ Aplicada |

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
| **P-007** | ~~Proteção de branch~~ — **fechada em 07/09/2026, verificado pela API do GitHub, não por afirmação.** O PO importou os dois rulesets versionados em [`.github/rulesets/`](../../.github/rulesets/). `GET /repos/.../rulesets` mostra os dois com `enforcement: active`: `develop - integracao protegida` (id 22238389, checks `Backend (Spring Boot)` + `Frontend (Expo Web)`) e `master - producao protegida` (id 22238407, os mesmos dois + `Origem do PR (master)`). Os nomes dos checks exigidos batem exatamente com os nomes dos jobs em `ci.yml` e `pr-origem-master.yml` — o segundo passo que o import não faz sozinho, feito corretamente. `GET /repos/.../branches/{develop,master}` confirma `protected: true` nas duas — efeito real, não só ruleset cadastrado. Repositório confirmado público (`private: false`), então a causa-raiz do sumiço original (privado no plano Free) não se repete. **Não feito, e não bloqueia o fechamento:** `bypass_actors` segue vazio nos dois rulesets — o primeiro passo do import (`Edit ruleset → Bypass list → Add bypass → Repository admin`) é opcional pelo próprio README dos rulesets, e continua como decisão em aberto do PO caso um push de emergência precise contornar um CI externo fora do ar. | Auditoria via `gh api`, 07/09/2026 | ✅ Fechada |

---

## M-004 — Cobertura que não falha quando o código quebra não é cobertura

**Data:** 04/09/2026 · **PR:** (Onda 1 de cobertura do frontend)

### Observação do PO

> "Os testes no Front end deve alcançar o minimo e 90%, Todo o front deve alcançar
> 90%. Os testes não devem ser testes para passar e aumentar covarage, devem ser
> testes reais com aplicações reais que irão testar de fato o comportamento do
> sistema e mante-lo seguro e com boa qualidade."

### Diagnóstico

A Onda 1 fechou a meta anterior — "todos os componentes em 90%" — mas só em
*statements*, *functions* e *lines*: em *branches* a pasta `components` está em 76,19%.
Pela régua das quatro métricas a meta antiga nem estava cumprida — e mesmo assim
entregou garantia falsa. O `code-review` provou **por mutação** que 3 dos 19
testes novos passavam com o código de produção quebrado:

| Teste | Mutação aplicada | Resultado antes da correção |
|---|---|---|
| `LoginScreen` — ramo de plataforma | `behavior={Platform.OS === "ios" ? "padding" : "height"}` → `behavior="padding"` | ✅ passava — e era esse teste que levava a tela a **100% de branches** |
| `CSTextField` — "sem label, nenhum rótulo" | `{label ? <Text/> : null}` → `<Text>` incondicional | ✅ passava, com o rótulo vazando como "VAZADO" na tela |
| `CSTextField` — "sem erro e sem dica" | `) : null}` → `) : <Text>linha vazada</Text>}` | ✅ passava |

O padrão: os três **cobriam** o ramo sem **verificar** o ramo. O contador de cobertura
não distingue as duas coisas — ele conta linha executada, não comportamento garantido.
O caso da `LoginScreen` é o mais claro: o número dizia 100% exatamente sobre o único
ramo que ninguém checava.

### O que mudou

1. **Régua do PO:** 90% em **todo** o frontend, nas quatro métricas — não só nos
   componentes. Estado na virada: 78,81 / 66,94 / 76,96 / 79,40.
2. **Validação por mutação vira parte de escrever teste.** Quebrar deliberadamente o
   código que o teste alega proteger e confirmar que o teste falha. Sobreviveu à
   mutação, é teste vacuoso — reescrever, não contabilizar.
3. **Piso do `coverageThreshold` sobe a cada onda**, como o teto de avisos do lint
   (E8-13): 70/58/65/70 → 78/66/76/79 → **79/67/77/80** → 90. Ganho que não vira piso não está
   protegido; apagar os testes novos voltaria a passar no CI.
4. **Ondas por risco, não por facilidade.** A próxima é o `GeofencingTaskService`
   (17,6% de statements, **6,9% de branches**) — o check-in automático por geofence,
   que roda em background, sem ninguém olhando a tela.

### Efeito colateral útil

O mesmo `code-review` achou o **BUG-03**: o controle "Esqueci minha senha"
(`LoginScreen.js:132`) tem `accessibilityRole="button"` e `accessibilityLabel`, e
nenhum `onPress`. A tela tinha acabado de ser certificada a 100% em todas as métricas
sem que nada notasse um botão que não faz nada. Registrado no inventário do E8-05 por
decisão do PO — implementar recuperação de senha é feature nova, não escopo de teste.

### Terceira passada — auditoria pedida pelo PO (04/09/2026)

O PO pediu explicitamente uma verificação de que "as correções realmente estão
implementadas e não houve falsos positivos". A auditoria aplicou **25 mutações** ao
código de produção da Onda 1 e rodou a suíte contra cada uma. **24 morreram** — as dez
correções das duas passadas anteriores estão de fato ativas, inclusive a nota sobre o
`fireEvent.press` recusar o toque por `accessibilityState.disabled`. O que a auditoria
achou de novo:

| Achado | Natureza | Desfecho |
|---|---|---|
| `CSTextField` — "digitar propaga o texto ao chamador" | **Teste vacuoso.** Sobrevivia à remoção de `onChangeText={onChangeText}` do `TextInput`: o `fireEvent` do RNTL sobe a árvore e acha o handler no elemento composto `<CSTextField>`, então o mock é chamado mesmo sem repasse. No aparelho, o campo ficaria mudo | Corrigido — desce até `campo.props.onChangeText`; mutação passou a matar |
| `filaOffline.test.js` — "preserva o `ocorridoEm` informado" | **Bomba-relógio.** Data absoluta `2026-09-03T10:15:00.000Z` num teste que lê de volta pelo `itensDaFila()`, que descarta itens acima de `VALIDADE_MS` (24h). Passou no CI em 03/09 e começou a falhar sozinho em 04/09. Veio da OPS-05 (#75) e **deixou a `develop` vermelha** | Corrigido — data relativa (`Date.now() - 1h`); mutação (ignorar o `ocorridoEm` informado) passou a matar |
| "12 de 12 componentes" (3 documentos) | **Afirmação falsa.** A pasta tem 11 componentes `CS*` mais o barril. Nenhuma leitura fecha em 12/12 | Corrigido para 11 |
| "`components/index.js` em 0/0/0/0" | **Diagnóstico errado.** Módulo só de reexportação: `total: 0` nas quatro métricas, `pct: 100` no `coverage-summary.json`. Não há statement a cobrir e nenhuma onda pode elevá-lo. A causa alegada também é falsa — 7 telas de produção importam o barril | Corrigido; item retirado da fila das ondas |
| "245 testes em 31 suítes" · "9 testes" na `LoginScreen` | Números defasados | Corrigidos para os medidos |
| `jest.setup.js` — `if (!global.fetch) { global.fetch = jest.fn(); }` | **Guard inerte.** O Node 20 tem `fetch` nativo, então a condição nunca era verdadeira e o spy nunca era instalado: o `fetch` real sobrevivia. O `App.test.js` (única suíte sem mock próprio, das 34) montava o `App` e disparava **HTTP de verdade** contra `192.168.0.10:8080`. Sockets TCP e os temporizadores de 20 s do `fetchComTimeout` sobreviviam ao teste — origem única do aviso *"A worker process has failed to exit gracefully"*, ~40 s de parede por execução e não-determinismo | Corrigido — atribuição incondicional, com padrão que rejeita em vez de ir à rede; `App.test.js` declara a resposta que espera. Suíte da tela: ~50 s → **9 s**; aviso eliminado |

**Lição de processo:** data absoluta em teste que atravessa lógica de expiração é a
mesma família do teste vacuoso — o teste deixa de falar sobre o comportamento e passa a
falar sobre o relógio. Entra na régua junto com a validação por mutação.

---

## M-005 — Portão que não passa pelo caminho quebrado aprova o deploy quebrado

**Data:** 06/09/2026 · **PR:** (este PR — BUG-07)

### O que aconteceu

O PO selecionou um raio na aba Mapa e recebeu "Erro interno do servidor". O backend
respondia **HTTP 500** em `GET /api/v1/hospitais?latitude=…&longitude=…&raioKm=5` e
**HTTP 200** na mesma rota sem coordenada. O deploy que publicou esse estado passou
verde nos dois smoke tests do CD.

### Diagnóstico

O smoke test de banco existia justamente porque `/actuator/health` não serve de
porteiro (o indicador do Mongo está desligado no `application.properties`). Mas ele
batia em `/api/v1/hospitais?page=0&size=1` — um `find()` simples, que **não toca
índice nenhum**. O defeito estava exatamente no que aquele caminho não exercita: os
índices declarados nunca eram criados, porque a propriedade estava sob o prefixo
errado e o Boot ignora chave desconhecida em silêncio.

O padrão é o mesmo do M-003 e do M-004, num terceiro lugar: **um portão que não
passa pelo caminho que pode quebrar não é portão.** No M-004 era o teste que passava
com o código de produção quebrado; aqui é o smoke test que passa com o banco sem
índice.

### O que entrou

- Um passo novo no `cd-backend-google.yml` que chama a listagem **com** latitude,
  longitude e `raioKm`, e falha o deploy se não vier 200 — com a mensagem apontando
  para os índices geoespaciais, que é onde a próxima ocorrência vai estar.
- Doze testes novos (4 de integração com Testcontainers, 8 unitários sobre a
  consulta), validados por mutação: seis mutações aplicadas, seis mortas.
- O mesmo exercício de mutação foi repetido sobre as correções anteriores
  (BUG-01, BUG-02, BUG-04, BUG-05 e BUG-06): as seis mutações do frontend também
  morrem, então a cobertura de regressão daquelas entregas é real, e não presumida.

### O que isto não cobre

O smoke test roda depois do deploy, contra a revisão nova. Ele impede que um estado
quebrado seja **declarado bom**; não impede que ele seja publicado. Nenhum ambiente
intermediário exercita a rota geoespacial antes do Cloud Run.

---

## M-006 — Validação alimentada pelo cliente, e configuração que não migra o dado

**Data:** 06/09/2026 · **PR:** (este PR — BUG-08)

### O que aconteceu

O PO relatou que uma pessoa a duas ruas do hospital era computada como paciente. O
backend tinha, desde o Épico 02, uma validação para exatamente isso: o check-in por
geofence resolve o hospital com `$geoIntersects` sobre a posição do usuário e recusa
quem está fora de todo polígono.

Ela nunca recusou ninguém. No evento `Enter`, o app enviava como "posição do usuário"
o **centro da região do geofence** — a coordenada do próprio hospital. O ponto chegava
sempre dentro do polígono, e a validação aprovava por construção.

### Diagnóstico

Duas lições, e a primeira vale além deste bug:

1. **Uma validação de servidor alimentada por um dado que o cliente derivou de si
   mesmo não é validação — é carimbo.** O código do servidor estava correto, a
   consulta estava correta, o índice estava correto (desde o BUG-07), e mesmo assim a
   regra não existia na prática. Isso não aparece em teste de unidade do servidor, que
   passa o ponto que quiser; aparece quando se pergunta **de onde vem** o dado que o
   servidor está conferindo. É a mesma família do M-003 e do M-004 — algo que parecia
   um portão e não era — num lugar novo: o portão estava certo, a entrada dele é que
   era fabricada pelo lado que ele deveria fiscalizar.

2. **Configuração que não migra o dado já gravado não corrige nada.** Os raios do
   geofence vivem em `app.seed.raio-*`, e o `SeedRunner` roda em `skip-if-not-empty`:
   só semeia banco vazio. Reduzir os números no `application.properties` teria efeito
   zero sobre os 340 estabelecimentos em produção — a correção existiria no código, o
   PR passaria verde, e o mapa continuaria desenhando os círculos antigos. Vale para
   qualquer propriedade que só é lida no momento em que o dado nasce.

### O que entrou

- `ReconciliacaoRaioGeofenceRunner`: regrava no startup os geofences fora do raio da
  categoria, idempotente, preservando o centro e **preservando polígono desenhado à
  mão** — a salvaguarda existe porque um geofence editado por um administrador
  descreve o terreno real e vale mais que o círculo da categoria.
- O check-in por geofence passa a enviar a posição real do aparelho, e **não envia
  nada** quando não consegue lê-la. A régua passou a errar para o lado de perder um
  check-in legítimo em vez de inventar um.
- Primeira suíte de testes do `GeofencingTaskService`, que não tinha nenhuma apesar de
  ser quem decide quem vira paciente. Treze mutações no total (7 backend, 6 frontend),
  treze mortas.

### Endurecimento no code-review (mesmo PR)

O `code-review` achou um furo na salvaguarda que preserva polígono desenhado à mão:
`ehCirculoRegular` exigia só "vértices equidistantes", então um **círculo liso desenhado
por ferramenta** (raio uniforme, lados suficientes) também passava e seria regravado com
o raio da categoria no próximo boot — destruindo o desenho do administrador. O guard
passou a exigir **exatamente 32 lados**, que é o que os três únicos caminhos que criam
círculo do produto produzem. Medido no banco real: dos 340 estabelecimentos, **340 têm
anel de 32 lados** — o guard curado não deixa nenhum de fora. Círculo de 16 lados
(ferramenta) é preservado; o teste correspondente mata a mutação.

### O que isto não cobre

A régua nova recusa quem está fora do polígono, mas o dado que ela protege continua
tão bom quanto a coordenada do CNES: as posições vêm com **4 casas decimais** (~11 m)
e marcam o ponto do cadastro, não o centro do terreno. Nenhum raio conserta um centro
errado — e não há, hoje, medição de quantos dos 340 estabelecimentos têm o centro fora
do próprio prédio.

---

## M-007 — Migração que regrava o documento inteiro perde edição concorrente

**Data:** 06/09/2026 · **PR:** #85 (achado suplementar de `code-review`, após o merge do BUG-08)

### O que aconteceu

O `code-review` sobre o diff do BUG-08 encontrou que `ReconciliacaoRaioGeofenceRunner`
lia o `HospitalDocument` inteiro por página, mudava só `geofence`/`atualizadoEm` em
memória e regravava o documento inteiro com `saveAll`. Sem campo de controle de
concorrência, uma edição administrativa (nome, endereço, `ativo` etc., feita por
`HospitalServiceImpl.atualizar` na janela entre a leitura e a escrita do reconciliador)
seria silenciosamente sobrescrita pelos valores antigos — um *lost update*. Janela
pequena, mas real: o reconciliador roda a cada cold start do Cloud Run, que pode
acontecer a qualquer hora do expediente.

### Por que não virou `@Version`

A correção óbvia — anotar `HospitalDocument` com `@Version` para o Spring Data
recusar a escrita em caso de conflito — foi descartada: os 340 documentos já
gravados não têm esse campo, e o Spring Data trata `version == null` como entidade
**nova**. O próximo `save()` de qualquer um deles (deste reconciliador ou de
`HospitalServiceImpl`) tentaria **inserir** um `_id` que já existe, quebrando com
`DuplicateKeyException` em produção — trocaria uma janela de corrida estreita por uma
falha garantida.

### O que entrou

- `ReconciliacaoRaioGeofenceRunner` passa a gravar via `BulkOperations` com update
  parcial e atômico por `_id` (`$set` só em `geofence`/`atualizadoEm`), em vez de
  `saveAll` do documento inteiro. Uma edição concorrente em qualquer outro campo
  nunca é tocada — o problema deixa de existir por construção, sem migração de schema.
- `posicaoAtual()` (`GeofencingTaskService.js`) ganhou timeout de 10 s sobre
  `Location.getCurrentPositionAsync`, que não tem timeout próprio e podia travar a
  confirmação de entrada indefinidamente em GPS instável — mesma classe de falha que
  o `E8-04` já havia blindado no HTTP, mas não replicada aqui.
- Suíte completa revalidada após a mudança: 151 testes de backend e 311 de frontend,
  0 falhas.

### Lição a repetir

**Um reconciliador/migração que só precisa mudar 1-2 campos não deve ler-modificar-gravar
o documento inteiro** — isso arrisca sobrescrever qualquer outro campo alterado por um
caminho concorrente (admin, outro job). Update parcial e atômico pelo identificador é o
padrão a seguir em futuros runners deste tipo (candidato natural: o próximo
`Order`-runner de migração/regravação em massa que precisar tocar poucos campos de um
documento maior).

---

## M-008 — Erros silenciosos críticos em auth/LGPD (auditoria de código morto)

**Data:** 08/09/2026 · **PR:** #98

### O que aconteceu

O PO pediu um code review de backend e frontend atrás de "lógicas mortas, ambíguas
ou que se sobrepõem, código que compromete o comportamento do sistema, códigos e
lógicas que disparam erros silenciosos". Dois agentes independentes leram o
código-fonte completo (não o diff) e encontraram 19 achados priorizados P0→P3
(`Documentos/08-analise tecnica/Auditoria-Codigo-Morto-Logica-Ambigua-Erros-Silenciosos-v1.0.md`).
Os 4 mais graves (P0) tinham o mesmo padrão: **mascaravam uma falha real como
sucesso**, ou **afirmavam uma ação de segurança/LGPD que não acontecia de fato**.

### O que entrou

- `UserServiceImpl.saveUser`: e-mail duplicado agora lança `ConflitoException`
  (409) em vez de devolver `HttpStatus.CREATED` (201) com `success:false` no
  corpo — um cliente que decide por status HTTP via um cadastro duplicado como
  sucesso.
- `AuthServiceImpl.revogar` (logout): `catch (RuntimeException)` genérico
  restrito a `DuplicateKeyException` — antes, qualquer falha na revogação do
  refresh token (inclusive Mongo indisponível) era engolida e o logout sempre
  respondia "sessão encerrada", mesmo com o token continuando válido.
- `AdminUserSeeder`: aborta o seed com log `ERROR` quando `app.seed-admin.senha`
  está ausente/vazio, em vez de criar um admin com hash de senha vazia (nunca
  autentica) e logar "criado com sucesso".
- `AuthDocument`/`AuthRepository` (coleção `auth_logins`) removidos — nunca
  eram escritos em lugar nenhum do sistema; a chamada `deleteByUser_Id` na
  exclusão de conta LGPD era um no-op permanente que, numa auditoria real,
  responderia errado sobre o que é apagado. Documentação corrigida em 3 lugares
  (Especificação da API, De-Para, Relatório de Aderência) + `backend/README.md`,
  que ainda descrevia um contrato de login pré-JWT (achado do `code-review`
  deste próprio PR).

### Lição a repetir

Os quatro achados compartilham a mesma forma: um `catch`/`if` que devolve
sucesso ou segue em frente sem propagar a falha real. Vale grep por
`catch (RuntimeException`/`catch (Exception` genérico e por respostas de
sucesso condicionais (`return new XResponse(false, ...)` com status HTTP fixo
no controller) em revisões futuras — é o padrão que gerou os 4 achados P0 aqui.

---

## M-009 — Bugs de comportamento e telas mortas no frontend (auditoria de código morto)

**Data:** 08/09/2026 · **PR:** #100

### O que aconteceu

Mesma auditoria do M-008 (ver aquela seção para o pedido original do PO):
dois agentes leram o código-fonte completo do backend e do frontend atrás de
código morto, lógica ambígua e erros silenciosos. Este PR entrega os 5 achados
P1 do frontend — bugs de comportamento reais, visíveis ao usuário.

### O que entrou

- `LoginService.logout()`/`excluirConta()` passam a chamar `pararGeofencing()`
  (best-effort) — o monitoramento nativo de geofence continuava rodando depois
  do logout/exclusão de conta.
- **Achado extra, descoberto ao corrigir o item acima:** `PerfilService.deslogar()`
  (botão "Sair" do Perfil) nunca chamava `LoginService.logout()` — o refresh
  token nunca era revogado no servidor quando o usuário saía manualmente pelo
  app, apesar de `LoginService` já estar importado no mesmo arquivo para
  outros usos. Corrigido para delegar.
- `App.js` passa a checar `feedbackAvaliavel()` (RN-09, janela de 24h) antes
  de abrir o formulário de feedback a partir de uma notificação — antes abria
  mesmo vencido, e o usuário só descobria ao tentar enviar (backend 404).
  **Achado do `code-review` deste mesmo PR:** a primeira versão da correção
  checava a validade da pendência *atual*, não se ela era da *mesma visita* da
  notificação tocada — uma notificação de uma visita já substituída por outra
  mais recente ainda abriria o formulário, com o hospital errado. Corrigido
  para exigir os dois: `pendencia.visitaId === data.visitaId` **e** dentro da
  janela de 24h, sobre a mesma pendência.
- `LoginScreen`: removido o link "Esqueci minha senha" sem `onPress`
  (**BUG-03** do inventário de bugs, `De-Para-Backlog-Features.md` §E8-05 —
  decisão anterior do PO em 04/09/2026 tinha sido "registrar e não corrigir";
  revisitada em 08/09/2026: a feature de recuperação de senha continua fora de
  escopo, mas o controle morto sai da tela).
- `UserScreen`: botão "Voltar" do cadastro ganhou `onPress` e o ícone corrigido
  (estava `ArrowRight`, sentido errado para "voltar").
- Removidas `SugestoesPendentesScreen`/`RevisarSugestaoScreen` — registradas
  em `App.js` mas nenhuma navegação do app chegava até elas, e o botão
  "Aprovar" navegava para uma rota (`HospitalForm`) que nunca existiu no
  cliente mobile. `De-Para-Backlog-Features.md` (E1-06) e `Features-MVP-v2.1.md`
  (F-10) atualizados.

### Decisão sobre import circular (achado do `code-review`, não aplicada)

O `code-review` apontou que `LoginService → GeofencingTaskService →
HospitalService/VisitaService → LoginService` fecha um ciclo de imports.
Tentativa de quebrá-lo com `import()` dinâmico foi **revertida**: a interop do
Jest com `jest.mock` sobre import dinâmico exige `__esModule: true` no mock, e
sem isso o binding chegava `undefined` — os dois testes que exercitam
`pararGeofencing()` quebraram. Trocar um risco teórico (o ciclo é seguro hoje
porque nenhum dos quatro módulos lê o binding no topo do arquivo, só dentro de
corpos de função) por um problema demonstrado não valia a pena. Ciclo mantido,
documentado em comentário no topo de `LoginService.js`.

### Lição a repetir

O achado extra do `PerfilService.deslogar()` é o mesmo padrão do M-007 e do
M-008: um módulo já importa a dependência certa para um caso de uso, mas um
método vizinho no mesmo arquivo reimplementa uma versão mais simples (e
incompleta) da mesma operação. Vale grep pelo nome do método “irmão” mais
completo (aqui, `LoginService.logout`) sempre que se mexe numa função de
limpeza/encerramento de sessão.

## M-010 — Um hospital público ausente, achado ao investigar uma lacuna que não era essa

**Data:** 08–09/09/2026 · **PR:** #103 (fechado, não mergeado) → PR seguinte na mesma branch

### O que aconteceu

Ao verificar se a base de 340 hospitais cobria "todos os hospitais existentes"
(pedido do PO), a rede pública SES-DF conferiu 100% contra a lista oficial da
Secretaria de Saúde. Interpretando o pedido de forma ampla, um primeiro PR
(#103, 08/09) classificou um extrato do CNES/DATASUS em PRIVADO/FILANTROPICO
e propôs importar 58 hospitais — mas **isso nunca tinha sido pedido**: o PO
esclareceu depois que hospitais privados ficam para uma versão futura, hoje a
base é só rede pública. PR fechado sem merge, nada foi para produção.

Reaproveitando a mesma extração/normalização/dedup (o PO pediu explicitamente
para não descartar esse trabalho), o mesmo cruzamento CNES foi refeito com o
objetivo certo: quantos hospitais **públicos** da rede SES-DF o CNES lista que
a nossa base não tem. Resposta, depois de verificar manualmente os 21
candidatos que não batiam por nome (a primeira passada não tinha feito essa
verificação individual, por não ser o objetivo daquela importação): **1**
— o Instituto de Cardiologia e Transplantes do Distrito Federal. Os outros 20
já existiam sob sigla diferente (10: HRAN, HRG, HRL etc.) ou são
federais/militares/temporários fora da rede SES-DF (10: Hospital Universitário
de Brasília, hospitais das três Forças Armadas, 5 hospitais de campanha
COVID-19).

### O que entrou

- `hospitais_publicos_complementares.json`: **1 hospital novo** (340 → 341).
  Proveniência completa, incluindo a tabela dos 21 candidatos verificados um a
  um, em `Documentos/07-dados/relatorio-importacao-CNES_PUBLICOS_COMPLEMENTARES_20260909.md`.
- `EstabelecimentoNormalizador`: normalização compartilhada entre o pipeline
  DBF/SHP existente e o novo pipeline JSON, extraída de `SeedMapper` para não
  duplicar Title Case/CNES/CEP pela segunda vez — parte reaproveitada do PR
  fechado, sem alteração.
- `SeedMapper#montarPublicoComplementar`: versão simplificada do que era
  `montarPrivado` no PR #103 — sem campo `tipo` no registro de entrada (é
  sempre PUBLICO, fixo no código), sem a lógica de rejeitar/aceitar por
  classificação. A proteção contra colisão de CNES reclassificar um hospital
  público em silêncio (achado do `code-review` no PR #103) deixou de ser
  necessária: com uma fonte exclusivamente pública, não há mais o risco que
  ela existia para prevenir.

### Lição a repetir

Duas, uma de cada PR desta mesma história:

1. **Verificar o escopo antes de expandir a interpretação de um pedido.** "Tenho
   certeza que pegamos todos os hospitais existentes" foi lido como "inclua
   privados", uma inferência razoável mas que nunca tinha sido confirmada —
   e só foi corrigida depois de o código já estar pronto e o PR aberto. Vale
   perguntar antes de expandir escopo com base em documentação (a
   Especificação da API menciona "públicos e privados" como contexto de
   mercado, não como status de implementação — outra leitura apressada).
2. **Verificação individual dos 21 candidatos** (sigla vs. nome completo)
   exigiu abrir a razão social e o endereço de cada um no CNES — não deu para
   confiar apenas no nome normalizado. A mesma tabela permitiu resolver com
   confiança sigla ambíguas (HRL = "Hospital da Região Leste"; HMAB =
   "Hospital Militar de Área de Brasília") que não teriam batido por nenhum
   critério de string matching.

---

## M-011 — Paginação truncada escondia até 240 hospitais no mapa e 320 na lista

**Data:** 09/09/2026 · **PR:** #105

### O que aconteceu

O PO relatou: com o filtro "1 km" selecionado no mapa, a UBS 05 do Recanto das
Emas aparece; com "Todos" selecionado, ela desaparece — o esperado é o
inverso, já que "Todos" deveria ser um superconjunto. Pediu para verificar se
o mesmo problema afeta outras unidades e a listagem da aba Hospitais.

### Diagnóstico

Medido diretamente contra o backend em produção: **340 hospitais ativos**.
Duas causas, uma no backend e uma em cada tela:

- `HospitalServiceImpl#listar` só usa a busca geoespacial (`$nearSphere`)
  quando `latitude`/`longitude` chegam. Sem elas ("Todos"), cai em
  `buscarPaginado`, que faz `mongoTemplate.find` **sem `Sort`** e pagina o
  resultado em memória — a ordem "natural" do MongoDB não é um contrato.
- `HospitalController` limita `size` a 100 por chamada (`@Max(100)`). O mapa
  pedia `size=100/page=0` para "Todos": só os 100 primeiros (por essa ordem
  instável) chegavam ao cliente — 240 hospitais nunca eram desenhados.
- A aba Hospitais (`HospitaisScreen`) nem informava `page`/`size`: caía no
  default do serviço (`size=20`), sem paginação incremental na `FlatList` —
  320 hospitais nunca apareciam sem busca pelo nome exato.
- Com um raio selecionado, a busca geoespacial reduz o total a poucos
  hospitais, que cabem numa única página — por isso a UBS só aparecia com
  "1 km".

Confirmado por medição: baixando as 4 páginas de 100 contra produção, a UBS
05 do Recanto está no índice 261 de 340 — muito além da janela de 100 que o
mapa pedia. Outras 7 UBS do Recanto (01, 02, 03, 04, 08, 10, 11) estão nos
índices 296–327, mesmo problema.

O PO escolheu, entre três opções apresentadas (paginação incremental, subir o
cap e carregar tudo de uma vez, ou só corrigir a ordenação sem mostrar o
catálogo completo), a **paginação incremental completa**: nenhuma tela deve
voltar a montar centenas de marcadores/cards numa única leva — o risco de ANR
do mapa (`Plano-Sprints-v2.1.md` §21.6, mesma família do BUG-04 já corrigido
nesta tela) continua valendo.

### O que entrou

- `HospitalServiceImpl#buscarPaginado`: `Sort.by("nome").and(Sort.by("id"))`.
  Só por nome não bastava — achado do `code-review` deste PR: o
  `ImportadorEstabelecimentos` (migração CNES) grava direto via
  `hospitalRepository.save`, sem passar por `validarUnicidade`, então dois
  hospitais importados podem legitimamente compartilhar o nome; o `id` entra
  como critério de desempate para garantir ordem total.
- `GeoLocalizacaoScreen` (mapa): com "Todos", percorre todas as páginas em
  sequência até completar o total, atualizando o mapa lote a lote em vez de
  esperar tudo para montar de uma vez.
- `HospitaisScreen`: scroll infinito real (`onEndReached`) com guard de
  geração (`geracaoRef`) contra uma busca/filtro nova enquanto uma página
  seguinte está em voo, e guard de reentrância por `ref` (não por estado) para
  não duplicar requisições num fling rápido — os dois, achados do
  `code-review` deste PR depois da primeira versão da correção.
- `RankingScreen`: a mesma dupla de guards, **fora do escopo original do
  bug relatado** — o `code-review` encontrou a mesma falta de proteção contra
  corrida já existente ali antes deste PR (não era uma regressão desta
  entrega). O PO decidiu corrigir no mesmo PR em vez de abrir dívida técnica
  separada.
- Testes de regressão nos três pontos (backend + 3 telas), cada um validado
  por mutação (falha de fato quando a correção é revertida).

### Lição a repetir

1. **Medir contra produção antes de propor a correção.** A causa só ficou
   inequívoca depois de baixar as 4 páginas reais e localizar o índice exato
   da UBS relatada (261 de 340) — sem isso, a hipótese seria só plausível, não
   verificada (`Verificar antes de afirmar`).
2. **Uma correção que introduz paginação incremental pede o mesmo escrutínio
   que qualquer estado assíncrono concorrente** — o `code-review` achou dois
   bugs de corrida (busca vs. "carregar mais"; reentrância por fling) na
   primeira versão da correção, e um terceiro pré-existente no `RankingScreen`
   só porque ele usa o mesmo padrão. Perguntar ao PO antes de expandir o diff
   para um arquivo fora do bug original, em vez de decidir sozinho.

---

## M-012 — Recuperação de senha: feature nova, 4 achados reais no code-review

**Data:** 10/09/2026 · **PR:** #110

### O que aconteceu

O PO pediu diretamente: "Esqueci minha senha. O usuário deve poder resetar
sua senha caso ele esqueça sua senha". O link já existia no `LoginScreen`
(sem `onPress`), mas foi **removido** em 08/09/2026 (BUG-03) por não ter
endpoint, tela nem envio de e-mail por trás — o PO havia decidido, nas duas
vezes em que o assunto surgiu (04/09 e 08/09), que implementar seria feature
nova e ficaria para uma estória própria. Esta é essa estória.

### Diagnóstico

Não existia nenhuma infraestrutura de e-mail no backend (nenhuma dependência
de mail/SMTP, nenhum secret configurado no CI) — teve que ser criada do zero.
Provedor (Resend) escolhido pelo usuário entre quatro opções apresentadas.
Mecanismo (código de 6 dígitos digitado no app, não link por e-mail) decidido
a partir de uma medição do próprio projeto: `app.json` não declara `scheme`,
então um link exigiria configurar Universal Links (iOS) e App Links (Android)
— infraestrutura à parte, arriscada de acertar sem hardware para validar.

### O que entrou

- `POST /api/v1/auth/esqueci-senha` e `/redefinir-senha` — públicos, já sob o
  rate limit de 10 req/min/IP que `/api/v1/auth/**` já tinha (nenhum código
  novo de rate limit).
- `PasswordResetTokenDocument` (TTL de 15 min, mesmo padrão de
  `RefreshTokenRevogadoDocument`), código hasheado com o `PasswordEncoder`
  (BCrypt) já existente, limite de 5 tentativas.
- `EmailService`/`ResendEmailService` — `RestClient` (sem dependência nova),
  envio assíncrono (achado do code-review, ver abaixo), nunca propaga falha.
- Reset invalida refresh tokens emitidos antes dele: `UserDocument` ganha
  `senhaAlteradaEm`; `AuthServiceImpl.refresh()` — que **já** carrega o
  `UserDocument` a cada renovação — compara o `iat` do token contra esse
  campo, sem nenhuma leitura extra de banco.
- Frontend: `EsqueciSenhaScreen` (duas etapas: e-mail → código+nova senha),
  link restaurado no `LoginScreen`.

### Os 4 achados do `code-review` (aplicados os quatro, nenhum descartado)

1. **Corrida no upsert do código.** `esqueciSenha` do frontend é
   `idempotente: true` (retry em 502/503/504) — duas requisições quase
   simultâneas para o mesmo e-mail liam "nenhum token" e as duas tentavam
   inserir; a segunda estourava `DuplicateKeyException` **sem captura**
   (diferente do `revogar()`, que já trata esse mesmo padrão de corrida há
   mais tempo), virando 500 em vez da resposta genérica sempre-200. Corrigido
   com upsert atômico via `MongoTemplate` — a corrida passa a ser resolvida
   pelo próprio Mongo, não há mais dois inserts concorrentes para capturar.
2. **Canal lateral de tempo.** O ramo "e-mail existe" fazia BCrypt + upsert +
   uma chamada HTTP síncrona ao Resend antes de responder; o ramo "não
   existe" só a consulta — mesmo com o corpo da resposta idêntico, a
   diferença de latência era medível e derrotava a proteção contra
   enumeração de e-mail. Corrigido em duas frentes: um `encode` BCrypt
   descartável no ramo inexistente (normaliza o custo de CPU) e o envio do
   e-mail virou `@Async` (`@EnableAsync` já ativo no projeto, mesmo padrão do
   `FeedbackSalvoEventListener`), tirando a chamada de rede externa do
   caminho de resposta.
3. **Corrida no contador de tentativas.** Um read-modify-write comum
   (ler `tentativas`, somar 1, salvar) perdia incrementos sob tentativas
   paralelas — o mesmo padrão de corrida do achado 1, num campo diferente.
   Corrigido com `$inc` atômico via `findAndModify`.
4. **Precisão do `iat`.** O claim `iat` do JWT só tem precisão de segundo
   (RFC 7519 NumericDate); comparar direto contra `senhaAlteradaEm` (com
   milissegundos) rejeitava, por engano, um refresh token emitido no MESMO
   segundo do reset mas de fato depois dele — um usuário que resetasse a
   senha e fizesse login de novo no mesmo segundo via a própria sessão nova
   ser recusada. Corrigido truncando `senhaAlteradaEm` ao segundo antes da
   comparação, o mesmo nível de precisão que o `iat` já tem.

Um quinto ponto (access tokens já emitidos continuam válidos até expirarem,
até 15 min, porque só o refresh é checado) **não é um achado novo** — já
estava registrado como trade-off explícito no plano antes da implementação,
por não valer a pena acrescentar uma leitura de banco a cada requisição
autenticada só para fechar uma janela de 15 minutos.

### Lição a repetir

1. **O mesmo padrão de corrida apareceu duas vezes na mesma entrega** (achados
   1 e 3) porque os dois vieram de um reflexo comum — "ler, decidir, salvar"
   — em vez de perguntar primeiro se o Mongo já resolve a operação de forma
   atômica. Antes de escrever um find-then-save/read-modify-write num campo
   que pode receber escrita concorrente, checar se `$inc`/upsert do
   `MongoTemplate` já cobre o caso — evita reintroduzir a mesma classe de bug.
2. **Um teste que passa "olhando de fora" pode não testar o mecanismo real.**
   `spy()` sobre `BCryptPasswordEncoder` para verificar o encode descartável
   quebrou a suíte inteira (métodos efetivamente finais no Spring Security,
   que o mock-maker padrão do Mockito não intercepta) — a correção não foi
   contornar com `verify` mais frouxo, foi isolar a verificação num
   `PasswordEncoder` mockado por interface, só naquele teste.

---

## M-013 — Confirmação obrigatória de e-mail no cadastro

**Data:** 10/09/2026 · **PR:** (este PR)

### O que aconteceu

O PO abriu uma lacuna na feature de recuperação de senha (#110): sem confirmar o
e-mail no cadastro, um endereço com erro de digitação ou inexistente nunca recebe o
código de "esqueci minha senha" — a conta fica sem recuperação possível. Só é
possível entregar o reset de senha de forma honesta se o e-mail do cadastro for de
fato do usuário.

### O que mudou

- `POST /auth/registro` (via `UserServiceImpl.saveUser`) dispara, logo após criar a
  conta, o envio de um **código de 6 dígitos** — reutilizando a infraestrutura de OTP
  já criada para o reset de senha, **generalizada** de
  `PasswordResetTokenDocument` para `CodigoVerificacaoDocument` (chave composta
  `email + proposito`, upsert atômico, TTL de 15 min, limite de 5 tentativas com
  `$inc` — as duas correções de concorrência anteriores valem para os dois fluxos).
- `login` passa a recusar **403 `EMAIL_NAO_CONFIRMADO`** até a confirmação — depois
  de validar a senha, portanto sem abrir canal novo de enumeração. É 403, não 401: a
  credencial está correta, o acesso é que está condicionado à confirmação.
- `POST /auth/confirmar-email` e `POST /auth/reenviar-confirmacao` (públicos,
  resposta genérica em ambos os ramos do reenvio — e-mail inexistente e já confirmado
  gastam o mesmo BCrypt dummy que o ramo que envia, sem canal lateral de tempo).
- `EmailVerificadoBackfillRunner` (ApplicationRunner) migra, no startup, as contas
  anteriores à feature para `emailVerificado=true` (`$exists: false` → idempotente):
  sem isso, todo usuário já cadastrado seria trancado para fora no próximo login — o
  "efeito cobra" que uma correção não pode causar.
- Frontend: tela nova `ConfirmarEmailScreen`, alcançada tanto do sucesso do cadastro
  (`UserScreen`) quanto do bloqueio do login (`LoginScreen`), testada de ponta a
  ponta pelo novo `ConfirmacaoEmailFluxoIntegracaoTest` (o código é capturado do
  `EmailService` mockado — só o hash BCrypt é persistido, não há outro jeito de lê-lo).

### Achados do review deste PR

1. **Oráculo de tempo em `confirmarEmail`** (`security-review`): o ramo "código
   inexistente ou vencido" respondia ~80 ms mais rápido que "código errado" (sem o
   BCrypt `matches`) — um canal lateral que, com 2 requisições públicas, distinguia
   contas ativas não confirmadas (preservando o alvo preferencial da força bruta de
   código). Corrigido com o BCrypt dummy no ramo de ausência, igualando os custos.
2. **Skill `code-review` em execução forked travou em loop de deliberação** (0 tool
   uses, 47 s) no momento de revisar este diff — o portão foi cumprido manualmente
   em vez de relançar a skill às cegas ([OBS-005](../../skill-observations/OBS-005-code-review-forked-travado.md)).

---

## M-014 — Mapa e Detalhe do Hospital quebrados na Web pós-migração Mapbox

**Data:** 16/09/2026 · **PR:** #117

### O que aconteceu

Não foi um relato do PO: apareceu durante a verificação ao vivo dos fluxos do app
no Expo Web para escrever um tutorial de usuário (`/documentation-writer`). A aba
Mapa e o Detalhe do Hospital renderizavam tela preta, com o React acusando
`Element type is invalid... Check the render method of HospitalDetalheScreen` /
`GeolocalizacaoContent`.

### Diagnóstico

A migração MapLibre → Mapbox (`@rnmapbox/maps` v10, já em `develop`) importa os
componentes de mapa (`MapView`, `Camera`, `ShapeSource`, `FillLayer`, `LineLayer`,
`MarkerView`) direto de `@rnmapbox/maps` nas duas telas. Essa biblioteca é nativa
(iOS/Android) e não publica build Web — no navegador os componentes chegam
`undefined`, e o React lança o erro ao tentar renderizá-los. `mapbox-gl` (a lib JS
equivalente) já estava no `package.json` desde a migração, mas nunca foi conectada
a nenhuma tela.

### O que mudou

- `frontend/src/utils/mapkit/index.js` (nativo): reexporta `@rnmapbox/maps` sem
  alterar comportamento — Android/iOS não mudam.
- `frontend/src/utils/mapkit/index.web.js`: implementa o mesmo subconjunto de API
  com `mapbox-gl`, cobrindo só o que as duas telas usam de fato — câmera imperativa
  (`setCamera`/`fitBounds`), geofences como fonte GeoJSON com clique detectando
  todas as features sobrepostas no ponto (mesmo contrato que o BUG-11 depende para
  oferecer a lista de escolha), e marcadores React renderizados via portal
  (`react-dom/client`) dentro de um `mapboxgl.Marker`.
- `frontend/src/utils/mapStyle.web.js`: variante Web da URL de estilo e do token de
  acesso (o arquivo original chama `Mapbox.setAccessToken`, inexistente na Web).
- Import trocado de `@rnmapbox/maps` para `../../../utils/mapkit` nas duas telas —
  a resolução por plataforma (`.web.js`) é automática no bundler, sem `if (Platform...)`.

### Achado do `code-review` deste PR

O `value` do `SourceContext.Provider` em `ShapeSource` era um objeto literal novo a
cada render. Como `GeoLocalizacaoScreen` re-renderiza a cada leitura de GPS, isso
fazia o efeito de `FillLayer`/`LineLayer` (dependente da identidade de `origem`)
remover e recriar a layer do geofence continuamente — um "piscar" visível, a mesma
categoria de quebra que este PR corrige. Memoizado com `useMemo`/`useCallback`.

### Achado ao testar o fluxo real (não coberto pelos testes automatizados)

Depois do primeiro deploy da correção, clicar num marcador de hospital **no mapa**
(não na lista) para abrir o detalhe deixava a tela em branco — os testes com mock
não pegam porque não exercitam o desmonte real do `mapbox-gl`. Causa: React desmonta
a árvore de cima para baixo; ao sair da aba Mapa, o cleanup do próprio `MapView`
(`mapa.remove()`) roda **antes** dos cleanups de `ShapeSource`/`FillLayer`/
`LineLayer`/`MarkerView`, que tentam operar num mapa que o mapbox-gl já destruiu por
dentro. Com o catálogo completo (~300 marcadores) montado, o mesmo desmonte em massa
também chamava `root.unmount()` de cada `createRoot` do `MarkerView` de forma
síncrona em pleno commit do React-Native-Web — "Attempted to synchronously unmount a
root while React was already rendering", centenas de vezes. Corrigido envolvendo as
operações de cleanup em try/catch silencioso (cleanup de mapa é best-effort: se ele
já não existe, não há nada a desfazer) e adiando `root.unmount()` com
`queueMicrotask`.

### Verificação

Backend local + MongoDB descartável (container à parte, sem tocar no volume
existente nem no Atlas de dev compartilhado) com os ~339 estabelecimentos reais
importados pelo seed: lista de hospitais, detalhe com geofence, mapa com ~330
marcadores, clique num marcador do mapa (abrir → voltar → abrir outro, em ciclo) e o
seletor de sobreposição do BUG-11 testados manualmente no navegador, sem erros no
console. `npx jest` (390/390) e `npx eslint` (0 erros/avisos nos arquivos novos ou
alterados) sem regressão.

---

## M-015 — Mapa: card do hospital ao tocar no marcador (padrão "Decolar")

**Data:** 20/09/2026 · **PR:** #123 (substitui o #122, fechado pelo GitHub ao renomear a branch) · reenquadramento ao voltar: #124

### O que o PO pediu

Na aba Mapa, ícones de hospital; ao selecionar um, abrir um card com as informações
básicas; ao tocar no card aberto, ir para a página de detalhe (referência: telas de
hospedagem do Decolar, com marcador destacado e card com botão de fechar).

### Achado ao investigar

O critério de aceite 3 da F-07 (`Features-MVP` v2.2) **já exigia** isso — "toque no pin
exibe card de detalhe rápido; toque no card navega para o Detalhe". O código fazia o
contrário: tocar no marcador navegava direto. O Relatório de Aderência dizia
"F-07 funcional" sem notar a diferença. Por isso os testes de BUG-04/05/10/11 —
escritos contra o comportamento antigo — quebraram (8) e foram **adaptados**, não
apagados: cada um continua provando o mesmo risco (desmontar o mapa antes de navegar,
container que reserva espaço, âncora simétrica, seletor de sobreposição).

### O que mudou

- `GeoLocalizacaoScreen`: estado `hospitalSelecionadoId`; toque no marcador seleciona,
  destaca (azul, ordem de renderização por último para ficar por cima) e centraliza a
  câmera sem mexer no zoom; o card (`CSHospitalCard` reaproveitado, com `CSIconButton`
  para fechar) fica **fora** do `MapView` — sobrevive ao desmonte-antes-de-navegar do
  BUG-04 e a seleção persiste ao voltar do detalhe. Marcador vira só ícone.
- `CSHospitalCard`: prop opcional `distancia` ("1,2 km de você"); ausente, a linha some
  (nunca "N/D").
- `mapkit/index.web.js` — **dois defeitos do shim Web só apareceram rodando o app real**
  (o mock do Jest não os pega):
  1. `flyTo({ zoom: undefined })` no `mapbox-gl` vira NaN e descarta o voo: o mapa não
     se mexia ao centralizar sem alterar o zoom. Agora só repassa as chaves informadas.
  2. `mapbox-gl` v2 só reage a resize da janela; o container encolhia quando a
     mensagem de GPS entrava (canvas 615 px num container de 526 → mapa descentrado,
     ~90 px cortados). Agora um `ResizeObserver` chama `map.resize()`.
  3. Os filhos do mapa (a `Camera` entre eles) só montam depois do evento `load`; ao
     **voltar do detalhe**, o efeito de enquadramento da tela rodava com `cameraRef`
     nulo e o `fitBounds` caía no vazio — o mapa reaparecia no Brasil inteiro, com os
     ~340 marcadores num borrão. Achado ao repetir o fluxo com cliques reais (o teste
     BUG-04 de "reenquadrar ao voltar" usa mock síncrono e passava). Agora o `MapView`
     do shim chama `onDidFinishLoadingMap` (mesma prop do `@rnmapbox/maps`) depois da
     montagem dos filhos, e a tela reenquadra nesse gancho. Anterior a este PR, mas
     estragava o fluxo "voltar com o card aberto".

### Achados do `code-review` deste PR

Corrigidos:
- **Seleção pendurada:** o `id` do hospital selecionado ficava guardado quando o raio o
  tirava da lista, e o card **voltava sozinho** ao restaurar o raio. Trocar o raio agora
  fecha o card (2 testes; mutação da correção morta).
- `converterAncora`/prop `anchor` do `MarkerView` Web: código morto depois do BUG-10
  (nenhum chamador em `src`), com comentário que ainda descrevia a âncora assimétrica.
  Removidos.
- Docstring do `CSHospitalCard` dizia que lista e mapa mostram distância (critérios 3 e
  4); só o mapa passa a prop. **O critério 4 da F-07 (distância na lista) segue em aberto.**

Aceitos, com o motivo:
- **Card cortado em tela muito curta:** o "X" fica 20 px acima do card, dentro de um
  container com `overflow: hidden`; some se a área do mapa tiver menos de ~230 px. O app é
  `portrait`, então só ocorre em aparelhos de altura útil < ~560 dp. Não validável aqui.
- **Toque no marcador também dispara o `ShapeSource` (Web):** medido no app real em zoom
  alto — com unidades empilhadas abre o card da de cima **e** o seletor "Várias unidades
  neste local" (que atualiza o card ao escolher). Já ocorria antes do PR e ajuda no caso
  empilhado; com uma unidade só, a seleção dupla é idempotente.
- Área de toque de 40 px (< 48 dp do RNF-01), remontagem dos 2 marcadores a cada troca de
  seleção e três varreduras lineares na lista de ~340: custo baixo, sem aparelho para
  medir; ficam como follow-up.

### Verificação

- `npx jest`: 410/410; `npm run lint`: 0 erros, 16 avisos = o teto (nenhum novo).
- **Mutação** (o critério do PO): 10 mutações na tela/card e 4 no shim Web, todas mortas
  pelos testes; arquivo restaurado e conferido por `diff` depois de cada rodada.
- App Web real contra a API de dev (~340 marcadores), com **cliques reais** e capturas de
  tela: marcador → card → detalhe → voltar (seleção persiste e o mapa reenquadra o DF) →
  trocar de hospital (marcador selecionado exatamente no centro do mapa) → fechar pelo X →
  trocar o raio (o card fecha e não volta ao restaurar "Todos"; canvas 526 px = container);
  zero erros no console.

### O que **não** foi validado

Aparelho físico: o toque no marcador usa props de responder do RN (não há como validar
gesto real aqui) e a área de toque é 40 px, abaixo dos 48 dp do RNF-01. No Web não há GPS
no navegador, então a linha de distância não aparece lá. Possíveis evoluções (fora deste
PR): ícone por categoria (UPA/UBS/hospital), tocar no mapa para fechar o card.

---

## M-016 — Bottom Tabs atrás da barra de navegação do sistema (Android)

**Data:** 22/09/2026 · **PR:** #125

### O que o PO reportou

Capturas de tela do aparelho físico: em celular com a barra de navegação clássica do
Android (os 3 botões na tela, não gestos), a barra de abas (Início/Hospitais/Mapa/Perfil)
ficava atrás dos botões do sistema — impossível tocar nela.

### Diagnóstico

`Tabs()`, em `App.js`, define `tabBarStyle` com `height: 64` e `paddingBottom: 8` fixos.
O `@react-navigation/bottom-tabs` soma sozinho a área de sistema (`insets.bottom`) à
altura e ao padding **quando a tela não define os dois no `tabBarStyle`** — mas um
`tabBarStyle` customizado entra depois no array de estilos da barra e **sobrescreve** os
dois, descartando o inset (confirmado no código-fonte da lib, `BottomTabBar.js`:
`getTabBarHeight` só soma `insets.bottom` se `style.height` não vier definido; o
`paddingBottom` do array default sofre o mesmo destino). Com a barra de gestos o inset é
~0 e o bug não aparece — só se manifesta com a barra clássica, que tem inset real. É por
isso que passou despercebido: a Web e os emuladores usados até aqui não têm barra física.

### O que mudou

- `App.js`: `Tabs()` chama `useSafeAreaInsets()` e soma `insets.bottom` à `height` e ao
  `paddingBottom` do `tabBarStyle`, em vez de valores fixos.
- Teste novo em `App.test.js`: o mock de `react-native-safe-area-context` ganhou um
  `__setMockInsets` (antes devolvia sempre zero, escondendo justamente este bug) para
  simular um aparelho com barra clássica (`insets.bottom: 48`) e afirmar que a `height`/
  `paddingBottom` da barra somam o inset.

### Achado à parte, fora do escopo desta correção

Rodando a suíte inteira várias vezes seguidas, `EsqueciSenhaScreen.test.js` (teste
"'Reenviar código' volta para a etapa e-mail...") falhou de forma intermitente (1 em 4
execuções) por causa de assincronia: `avancarParaEtapaCodigo()` só espera o **mock do
serviço** ser chamado, não a **UI** mudar de etapa, e o teste seguinte pressiona
"Reenviar código" antes de a tela necessariamente já ter trocado de etapa. Não é
código de produção quebrado — é o teste que corre risco de dar falso negativo. Registrado
aqui para abrir tarefa própria; nenhum arquivo desse teste foi tocado neste PR.

### Verificação

- Teste novo mata a mutação (altura/padding fixos de volta, e só um dos dois corrigido).
- `npx jest`: 411/411 (rodado 4× para checar estabilidade — só a flakiness pré-existente
  acima apareceu, e só 1 das 4 vezes). `npm run lint`: 0 erros, 16 avisos = o teto.
- Não testado no aparelho físico que reportou o bug — só a lógica confirmada contra o
  código-fonte da lib e o teste de regressão. Fica como validação pendente do PO no
  próximo APK.

---

## M-017 — Ambiente de homologação e APK que atualiza sem desinstalar

**Data:** 22/09/2026 · **PRs:** #126 (APK) · #127 (homologação)

### O que o PO pediu

Fechar uma tag de homologação levando a `develop` para a `master`, com ambiente
separado, e APK versionado que atualize sem desinstalar — até aqui todo APK novo
exigia desinstalar o anterior (`apk-develop-release-ASSINATURA-EFEMERA-…`).

### Decisões do PO

`master` = homologação (produção fica para `release/<tag>`) · APK em **GitHub
Releases** · banco `saude_monitor_hom` no mesmo cluster Atlas, com usuário próprio ·
APK HML **lado a lado** com o de dev.

### Diagnóstico (medido antes de mudar)

- **Por que o APK exigia desinstalar — duas causas, não uma:** o secret da chave nunca
  foi criado (cada build gerava uma chave nova) **e** o `versionCode` era `1` fixo. Só
  corrigir a chave não bastaria: sem `versionCode` crescente o Android não reconhece o
  APK novo como atualização.
- `master` estava 277 commits atrás da `develop`; o CD do backend mandava `master` para
  secrets `_PROD` inexistentes; nenhum GitHub Release existia.
- **Deriva de documentação:** `deploy/google/setup-gcp.sh` criava secrets
  `saude-monitor-*-dev` que o workflow nunca leu (os de dev em uso se chamam `MONGO_URI`,
  `JWT_SECRET`, `RESEND_API_KEY`, criados à mão); o manual de git-flow ainda descrevia o
  Render e `master` = produção.

### O que mudou

- **APK** (`build.gradle` + `cd-mobile-apk.yml`): chave de release lida de secrets;
  `versionCode`/`versionName` por build; pacote e nome por ambiente (`.dev`/`.hom`;
  sem sufixo reservado a produção). Homologação **falha** sem a chave, em vez de
  publicar um APK que ninguém consegue atualizar depois.
- **`cd-homologacao.yml`** (novo): versão `vX.Y.Z-rc.N` → backend HML + 3 smoke tests →
  APK apontando para a URL recém-publicada → tag + GitHub Release. Se qualquer etapa
  falhar, não há tag. Recusa versão menor que a última homologada.
- **Backend:** `master` → `saude-monitor-backend-hom` com secrets `_HOM`; GitHub
  Environments (`desenvolvimento`/`homologacao`/`producao`) com histórico de deploy.
- `deploy/google/setup-homologacao.sh`: cria os secrets `_HOM` sem expor valores (gera o
  `JWT_SECRET_HOM` sozinho; recusa URI que não aponte para `saude_monitor_hom`).

### Achados do `code-review` (PR do APK), corrigidos antes do PR

Entradas vazias do chamador caíam em valores de dev (URL e versão) · secrets não
declarados no `workflow_call` deixariam o mapa em branco em silêncio · só 1 dos 4
secrets da chave era checado (senha errada só aparecia após ~20 min de Gradle — agora
`keytool -list` antes) · chave de release usável a partir de qualquer branch ·
concorrência cancelando o APK de homologação · `DEPLOY.md` desatualizado. **Aceito:**
build local sem `-Pambiente` sai com o pacote sem sufixo (a CLI do Expo abre o app por
ele; produção ainda não existe).

### Achados do `code-review` (PR do ambiente de homologação), corrigidos antes do PR

- **Disparo manual fora da `master`** publicaria o backend de DEV e uma "rc de
  homologação" apontando para ele — o job `versao` agora recusa outra ref.
- **Backend publicado antes do APK:** se o APK falhasse, o HML ficaria com código novo
  sem rc, e o APK antigo dos testadores falando com uma API que pode ter mudado. A ordem
  virou **APK → backend → tag**; o APK usa a URL determinística do Cloud Run
  (`<serviço>-<nº do projeto>.<região>.run.app`, conferida no serviço de dev) e o job
  final prova que ela responde antes de publicar.
- **`release.yml` cortava produção da ponta da `master`** — que agora é homologação e
  pode ter commit não homologado. Passou a receber a **tag da rc validada**.
- Script de secrets aceitava valor vazio (deixava secret sem versão, tratado como "já
  existe" na execução seguinte); comentário da fila de concorrência prometia algo que o
  GitHub não faz (só 1 execução pendente por grupo); clone completo só para ler tags.
- **Aceito:** toda promoção gera rc, mesmo sem mudança de código — promoção é ato
  deliberado e a rc é o retrato daquele commit.

### Verificação

- **CI real** (run 35768427033, dispatch na branch): APK `com.gabrielvogado.saudemonitor.dev`,
  `versionCode 49`, `1.0.0-dev.49`, nome "Radar Saúde DEV" (lido com `aapt2` no APK
  baixado); assinado pela chave efêmera, como esperado sem os secrets, e com a branch e
  `-ASSINATURA-EFEMERA` no nome do arquivo.
- Gradle local (JDK 17): manifesto HML com pacote `.hom`, nome "Radar Saúde HML",
  versão das propriedades; `signingReport` usa a chave quando fornecida e a `debug` sem
  ela; ambiente inválido derruba o build.
- Lógica do workflow simulada fora do CI: assinatura em 8 cenários e cálculo de versão
  em 6 contra um remoto local (primeira rc, sequência, re-execução no mesmo commit, troca
  de base, versão menor recusada, `1.10.0` sem confundir com `1.1.0`).

### Primeira rc (23/09/2026) — três falhas, três lições

1. **`bad auth` no Atlas:** a senha dentro de `MONGO_URI_HOM` não era a atual do usuário
   `saude_monitor_hom`. O pipeline se protegeu como desenhado — APK pronto, backend
   recusado, **nenhuma tag criada**. Corrigido com nova versão do secret.
2. **Seed parado por CPU:** com o banco vazio, o `SeedRunner` (ApplicationRunner) roda
   **depois** de o Tomcat abrir a porta; o Cloud Run já considera a instância pronta e
   estrangula a CPU entre requisições. O seed só avançava durante as requisições do smoke
   test (114 → 135 → 154 hospitais, medido pela API) e o `/actuator/health` ficava
   `OUT_OF_SERVICE` (readiness só vira `UP` depois dos runners). **Risco:** instância
   desligada no meio deixaria o banco parcial para sempre (`skip-if-not-empty`).
   Destravado alimentando requisições até `Concluído — novos: 339`. **Causa estrutural
   aberta:** vale para qualquer banco vazio no Cloud Run (produção incluída) — o seed
   precisa rodar antes de a porta abrir, ou com CPU sempre alocada.
3. **Reexecução só dos jobs que falharam** não preserva outputs de workflow reutilizável:
   o nome do artefato chegou vazio e o `download-artifact` tentou baixar tudo. O job
   `release` passou a achar o APK pelo commit e tirar a versão do nome do arquivo.

### O que ainda não foi validado

A cadeia inteira (`cd-homologacao.yml`) só roda de verdade no primeiro push na
`master`, depois que o PO criar a chave e os secrets. E "instalar por cima sem
desinstalar" só se confirma num aparelho, com duas rcs seguidas.

---

## M-018 — Rate limit contornável por X-Forwarded-For forjado; limites por ambiente

**Data:** 23/09/2026 · **PR:** #131

### Como apareceu

Ao planejar os testes de desempenho da homologação (100 usuários saindo de uma única
máquina), a leitura do `RateLimitFilter` mostrou duas coisas: os limites da F0-04 (10
logins/min e 60 req/min por IP nas rotas públicas) mediriam o limitador, não o sistema —
e a chave do limite era o **primeiro** endereço do `X-Forwarded-For`, que é escrito pelo
próprio cliente.

### Falha de segurança

Trocando o `X-Forwarded-For` a cada requisição, qualquer cliente caía numa chave nova e
**nunca** era limitado — inclusive no login, anulando a proteção contra força bruta de
senha. Agora vale o endereço acrescentado pelo proxy confiável (o N-ésimo contando da
direita; N = `app.ratelimit.proxies-confiaveis`, 1 no Cloud Run), lendo **todas** as
linhas do cabeçalho (achado do code-review: ler só a primeira reabria o contorno).

### O que mudou

- Limites em `app.ratelimit.*` (padrões iguais aos de antes), validados no startup —
  um `0` faria toda rota pública, inclusive o health check, responder 429.
- Homologação: **300** logins/min e **2000** req/min públicas, dimensionados para a
  jornada de 100 usuários. Não ilimitados: o serviço é público, e login sem limite abriria
  força bruta contra as contas de homologação (achado do code-review — a primeira versão
  usava 100000).
- 429 registrado em log com o IP, **uma vez por IP por janela** (não uma por requisição),
  para conferir em produção que a chave é o cliente e não o proxy.

### Verificação

- Testes novos: cabeçalho forjado, várias linhas de cabeçalho, 0/1/2 proxies, cabeçalho
  curto, limites por configuração. **4 mutações, 4 mortas** (voltar a ler o primeiro
  endereço; ignorar `proxies=0`; limite fixo em 60; ler só a primeira linha).
- Suíte do backend: 270 testes, 0 falhas (com Testcontainers).
- `security-review`: sem achados. `code-review`: 6 achados corrigidos; aceitos —
  reserva no endereço da conexão (no Cloud Run o cabeçalho sempre existe), troca pelo
  `RemoteIpValve` (outro escopo), contadores por instância/IPv6 (pré-existente; hoje
  máximo de 1 instância).

### A conferir depois do deploy

Que no Cloud Run o endereço mais à direita é mesmo o do cliente: o log de 429 mostra a
chave usada; comparar com o IP de quem gerou o 429.
## M-019 — Testes de desempenho da homologação: métricas ao vivo, relatório e limites gratuitos

**Data:** 23/09/2026 · **PR:** #133

### O que o PO pediu

Testes de desempenho "partindo do sistema como um usuário final" — com check-ins,
checkouts e feedbacks, fora o "esqueci minha senha" —, um sistema de análise de métricas
com relatório, acompanhamento **ao vivo** das requisições, e sem estourar os limites
gratuitos do Cloud Run e do Atlas. Ferramenta indicada pelo PO: a skill
`jovd83/performance-testing-skill` (instalada após auditoria: sem `postinstall`, scripts só
leem JSON do k6; varredura do instalador "Safe/0 alertas"). O primeiro nome indicado,
`qaskills`, não existe no npm — nomes parecidos pertencem a outros autores.

### O que mudou

`perf/` (roda no Docker local, custo zero): Prometheus coletando o `/actuator/prometheus`
da homologação (com um ADMIN de coleta e renovação do token de 15 min), k6 enviando as
métricas do lado do usuário por *remote write*, Grafana com painel ao vivo (atualiza a cada
5 s), jornada k6 com 12 fluxos medidos um a um, **vigia** que aborta o teste acima de 90
op/s no Mongo, scripts de preparo/limpeza dos dados de teste e relatório de análise
(cliente + servidor + Mongo por comando + consumo dos limites gratuitos).

### Limites que decidem o desenho (medidos nas páginas oficiais em 23/09/2026)

O gargalo não é o Cloud Run (2 milhões de requisições/mês), é o **Atlas M0: 100
operações/s** — acima disso o Atlas estrangula o cluster, que é o **mesmo do dev**. A carga
foi dimensionada a partir do custo medido de uma jornada, não de um palpite.

### Achados durante a construção

- **Jackson 3 recusa primitivo ausente:** o `LoginRequest` tem `boolean rememberDevice`
  primitivo; um corpo sem ele volta 400 "corpo malformado". O app sempre o envia; os
  scripts passaram a enviar. Vale para qualquer cliente novo da API.
- **Contagem por `increase()` subestimava:** série que nasce no meio da janela perde o
  primeiro valor — o baseline mostrava 15 requisições onde houve 28. O relatório passou a
  usar a diferença dos contadores entre início e fim.
- O Cloud Run não expõe CPU ao contêiner (`process_cpu_usage = -1`); o relatório diz
  "indisponível" em vez de um número falso.
- O renovador do token gravava num volume sem permissão e falhava **sem aviso**; agora
  roda como root e registra a falha.

### Achados do `code-review`, corrigidos antes do PR

- **Vigia cego sob carga:** sem dado no Prometheus (coleta lenta, token expirado, cold
  start) ele lia "0 op/s" e parava de proteger o limite. Agora "sem dado" conta como alerta
  e aborta após 30 s.
- **Limpeza apagava nota real:** apagar o agregado de todo hospital tocado sumiria com a
  nota de quem tem avaliações reais. Agora só apaga onde não sobrou dado real; nos demais
  marca a visita real mais recente para o job do backend recalcular.
- Um usuário de carga inexistente podia ser sorteado (o vigia ocupa um id de VU); o vigia
  somava VUs de execuções anteriores; senhas e URI apareciam como argumento de processo.

### Baseline (23/09/2026, 2 usuários)

24/24 verificações, **0 erros**, **p95 da jornada 165 ms** (meta 300 ms); fluxo mais lento
login (p95 230 ms). **≈ 61 operações de Mongo por jornada** → carga de 100 usuários
dimensionada em ~50 op/s de pico, com início espalhado em 120 s.

---

## M-020 — `raioKm` negativo derrubava a listagem com HTTP 500 (achado do pentest)

**Data:** 23/09/2026 · **PR:** #136

### Como apareceu

Pentest autorizado da homologação (F-01, `Documentos/12-seguranca/Pentest-HML-2026-09-23.md`):
`GET /api/v1/hospitais?latitude=-15.8&longitude=-47.9&raioKm=-5` respondia **HTTP 500**.

### Causa

`HospitalServiceImpl.buscarProximos` passava o parâmetro direto para
`maxDistance(raioKm * METROS_POR_KM)`. Com `raioKm` negativo, o MongoDB recusa a
`maxDistance` negativa e a exceção não tratada virava 500 (erro genérico), em vez de um
400 de validação. `latitude`/`longitude` fora de faixa iam pelo mesmo caminho.

### O que mudou

- `HospitalController.listar`: `@DecimalMin(value="0", inclusive=false)` + `@DecimalMax("1000")`
  em `raioKm`; `@DecimalMin/@DecimalMax` de faixa em `latitude` (-90..90) e `longitude`
  (-180..180). Bean Validation ignora `null`, então o filtro por raio segue opcional.
- Teste em `HospitalListagemValidacaoIntegracaoTest` (contexto completo — o MockMvc
  standalone não instala o `MethodValidationPostProcessor`, então validaria com o bug
  presente). 6 casos; mutação confirmada (sem a constraint, 3 caem com 500/200).

### Verificação

- `raioKm=-5|0|5000` e `latitude=120` → 400 `CAMPOS_INVALIDOS`; `raioKm=5` e sem filtro → 200.
- Suíte do backend: 278 testes, 0 falhas.

---

## M-021 — F-02/F-03 do pentest: 401 vs 403 e HSTS ausente

**Data:** 23/09/2026 · **PR:** #138

### Como apareceu

Achados F-02 e F-03 do pentest de 23/09/2026
(`Documentos/12-seguranca/Pentest-HML-2026-09-23.md`), ambos informativos — o F-01
(`raioKm`, mesma sessão) já tinha sido corrigido no M-020.

### F-02 — 401 em vez de 403 para dono divergente

`NaoAutorizadoException` (401) era usada tanto para "não autenticado" quanto para "está
autenticado, mas o recurso é de outro usuário" (BOLA em visita e feedback) — os dois
casos misturados na mesma classe, apesar de terem semântica HTTP diferente: 401 significa
"sem credencial"; aqui a credencial existe e é válida.

### O que mudou (F-02)

- Nova `AcessoNegadoException` (403, código `ACESSO_NEGADO`) — o mesmo código que
  `RestAccessDeniedHandler` já usa para BFLA (papel insuficiente via Spring Security);
  agora BOLA (dono divergente, decidido em serviço) usa o mesmo código.
- `VisitaServiceImpl.obterAtivaOu409` e `FeedbackServiceImpl.exigirDono` passam a lançar
  `AcessoNegadoException` em vez de `NaoAutorizadoException`. Os demais usos de
  `NaoAutorizadoException` (login, refresh, "usuário não autenticado") ficaram como
  estavam — são 401 de verdade.
- Frontend conferido: o interceptor de refresh de token só age em `status === 401`; o
  tratamento de fila offline trata 400–499 igual. A troca não quebra nenhum fluxo do app.

### F-03 — sem HSTS

Sem `Strict-Transport-Security` nas respostas. Causa: o writer padrão do Spring Security
só emite o cabeçalho quando `request.isSecure()` é verdadeiro — e no Cloud Run o TLS
termina no front-end do Google, a aplicação recebe a conexão como HTTP simples, então
`isSecure()` é sempre falso.

### O que mudou (F-03)

- `SecurityConfig` registra um `HstsHeaderWriter` com `AnyRequestMatcher.INSTANCE`, que
  emite o cabeçalho sempre, sem depender do esquema visto pelo contêiner.
- **Decisão que ficou registrada:** não usar `server.forward-headers-strategy=framework`
  para isso (resolveria o `isSecure()` de forma mais "correta", mas o
  `ForwardedHeaderFilter` do Spring confia cegamente no primeiro endereço de
  `X-Forwarded-For` — reabriria por outro caminho o contorno de rate limit que o M-018
  fechou no `RateLimitFilter`).

### Verificação

- Testes novos: `VisitaServiceImplTest` e `FeedbackServiceImplTest` (dono divergente →
  403), `HospitalListagemValidacaoIntegracaoTest` (cabeçalho HSTS presente numa conexão
  não seguera simulada pelo MockMvc — o mesmo cenário do Cloud Run real).
- 3 mutações, 3 mortas (voltar cada troca ao estado anterior derruba o teste
  correspondente).
- Suíte do backend: 281 testes, 0 falhas. `code-review`: sem achados.

---

## M-022 — Re-medição do Épico 8 (E8-01, E8-02, E8-08): documento alinhado ao número real

**Data:** 24/09/2026 · **PR:** #141

### Como apareceu

Pedido do PO para confirmar o estado real de itens do Épico 8 em vez de repetir o
`De-Para-Backlog-Features.md`, cuja última verificação era de **02/09/2026** — antes da
migração para o Cloud Run e das ondas de teste. Régua da casa: **proibido afirmar um
estado sem medi-lo**. Nada abaixo veio do documento; cada número saiu de uma execução de
24/09/2026.

### E8-01 — cold start: continua **não resolvido** (confirmado pela via autoritativa)

- `gcloud run services describe saude-monitor-backend-hom --region=southamerica-east1`:
  annotation `autoscaling.knative.dev/minScale` **ausente** (⇒ `--min-instances=0`, default
  do Cloud Run) e `maxScale='1'`. O piso que eliminaria o cold start nunca foi aplicado.
- A primeira requisição da sessão veio 200 em 0,23 s — **medida de instância quente**, por
  tráfego recente dentro da janela de ociosidade, **não** por instância mínima; não avalia
  esta estória, exatamente como o próprio E8-01 já registrava.
- Achado lateral: `maxScale=1` é um teto de **uma** instância — irrelevante para o cold
  start, registrado no E8-01 por ser um limite de escala real.
- **Tentativa de reproduzir o cold start:** após **16 min sem tráfego** (da minha parte), a
  primeira requisição voltou 200 em **0,656 s** (a segunda, 0,188 s) — **sem 503 e sem os
  ~14 s do JVM**. A instância ainda estava viva: a janela até escalar a zero é maior que 16
  min, ou tráfego real da homologação resetou o relógio. Resultado empírico **inconclusivo**.
- **Logs do Cloud Run (48 h), fonte autoritativa:** 503 reais em `/actuator/health` existem
  (23/09 12:32, 06:22, 02:43 UTC), mas os do período **coincidem com `DEPLOYMENT_ROLLOUT`**
  nos mesmos instantes — arranque por deploy, não por ociosidade; latência baixa
  (0,007–0,587 s), o 503 falha rápido por falta de capacidade. **Nenhum 503 em 24/09.** O
  cold start segue possível (`min=0`), mas o exemplar limpo por ociosidade continua sendo o
  de 05/09 (14,778 s) — não reproduzido hoje.

### E8-02 — latência quente: os GET **cumprem** o orçamento; o **login não**

12 amostras por endpoint, ponta-a-ponta da máquina local até o Cloud Run (São Paulo),
serviço quente (meta RNF-02: p95 ≤ 300 ms):

| Endpoint | p50 | p95 | max |
|---|---|---|---|
| `GET /actuator/health` | 182 ms | 209 ms | 209 ms |
| `GET /api/v1/hospitais?page=0&size=1` (find) | 226 ms | 242 ms | 263 ms |
| `GET /api/v1/hospitais?...&raioKm=5` (geo, F-07) | 175 ms | **196 ms** | 210 ms |
| `POST /api/v1/auth/login` (conta ADMIN de carga) | 318 ms | **1074 ms** | 4263 ms |

Os GET batem com o k6 do `perf/` (p95 157 ms com 100 usuários, M-019). Os "1,9–4,9 s" do
De-Para eram estado frio/Render antigo, nunca re-medido sobre o Cloud Run quente. **O
login estoura o orçamento** (p50 já em 318 ms, p95 1074 ms), pior que os 310 ms do k6: é o
caminho do **BCrypt**, CPU-bound por desenho, e o `maxScale=1` (uma vCPU) explica a cauda
longa (max 4263 ms). Os usuários de carga `perf-N` foram limpos (login 401); usei a conta
ADMIN coletora, que passa pelo mesmo caminho de autenticação. **Ressalvas:** (a) fechar o
E8-02 exige trazer o login ao orçamento **ou** aceitá-lo como exceção justificada do
BCrypt; (b) 12 amostras de um cliente **não** são teste de carga; (c) o `maxScale=1` limita
sob concorrência acima de uma instância; (d) o cold start (E8-01) segue como o pior caso.

### E8-08 — cobertura: subiu nas duas pontas; frontend ainda **abaixo** dos 90% do PO

Suítes completas rodadas em 24/09/2026, 0 falhas.

- **Frontend** (`jest --coverage`, 411 testes / 42 suítes), lido do `text-summary` da run
  (o `coverage-summary.json` do repositório estava desatualizado, de uma run anterior):
  **84,32%** statements · **73,49%** branches · **80,14%** functions · **85,29%** lines.
  Régua do PO é 90% nas quatro — **nenhuma atinge**; *branches* é a mais distante (−16,5pp).
  Ainda assim, subiu em tudo sobre o último snapshot do De-Para (79,71/67,72/77,67/80,22).
- **Backend** (`gradlew test jacocoTestReport`), lido do `jacocoTestReport.xml`:
  **80,15%** instruções · **65,92%** branches · **79,24%** linhas (piso próprio 65%/50%,
  cumprido). Muito acima do documento (67,49% / 51,78%).

### Decisão do PO (24/09/2026)

Diante dos números acima, o PO decidiu:

- **E8-02 — fechar com exceção documentada.** Os caminhos **GET** cumprem o orçamento do
  RNF-02 sob carga (k6 M-019: 100 usuários, p95 157 ms) e no spot check quente de hoje. O
  **login** é aceito como **exceção justificada**: o BCrypt é lento por segurança, por
  desenho, e trazê-lo abaixo de 300 ms significaria enfraquecer o custo do hash. Estória
  marcada ✅ **com exceção**; placar do Épico 8 vai a 8/15. Se a exceção precisar ser revista,
  o ponto de ataque é o `maxScale=1` (cauda sob concorrência), não o BCrypt em si.
- **E8-01 — só medir, não decidir agora.** A troca para `--min-instances=1` (que eliminaria
  o cold start ao custo de uma instância ociosa cobrada 24/7) **não** foi feita nesta sessão;
  fica para decisão do time. Os números e a config ficam registrados. Estória segue 🟡.

### O que mudou

- `De-Para-Backlog-Features.md`: nota de verificação do cabeçalho, correção do parêntese
  "1–5 s por requisição com o serviço quente" no aviso do Placar (contradito pela medição),
  e apêndice de 24/09/2026 nas linhas **E8-01** (config + sonda de ociosidade + logs),
  **E8-02** (🔴 → ✅ com exceção, GET + login) e **E8-08**. **Placar do Épico 8: 7 → 8 de 15
  (47% → 53%)**, pela decisão do PO abaixo.
- **Armadilha de medição corrigida (PR #142, `fix(testes)`):** o `jest.config.js` ganhou o
  reporter `json-summary`, para o `coverage-summary.json` regenerar a cada run e não mais
  enganar como enganou aqui (mostrava a "Onda 1" sobre uma run de 411 testes). Verificado:
  mtime regenerado e `total` idêntico ao `text-summary`.
- Fora essa correção de test-infra, nenhuma mudança de código: esta entrada é medição e
  alinhamento documental.

### Verificação

- Reprodutível: `gcloud run services describe`, `gcloud logging read` (503/`Starting new
  instance`), `curl -w "%{time_total}"` em laço (GET e `POST /auth/login`), sonda de cold
  start com 16 min de ociosidade, `jest --coverage`, `gradlew jacocoTestReport`. Números
  acima são a saída dessas execuções.

---

## M-023 — Painel Administrativo Web (F-11/Épico 7) retomado: fundação + primeiras estórias

**Data:** 24–25/09/2026 · **PRs:** #143, #144, #145, #147, #148, #150, #151 · **ADRs:** ADR-012, ADR-013

> Registro consolidado da frente do painel (backfill de conformidade — o `CLAUDE.md`
> pede registrar melhorias reais no Historico, e esta frente vinha só em ADRs + De-Para).

### O que apareceu

O Épico 7 (Painel Admin Web), adiado desde 02/09 (D-01), foi **retomado por decisão do PO
em 24/09/2026**. O fluxo de moderação (E1-06) e a gestão de hospitais dependem dele.

### O que mudou

- **Stack e fundação (ADR-012, #143):** SPA **Angular 21** em `admin/` (Node 20.19 não roda
  o v22), autocontida para o split futuro em repos (`radar-saude-mobile`/`painel-admin-frontend`/
  `radar-saude-backend`).
- **CORS (#144):** o backend não liberava a origem do painel (browser); `SecurityConfig` +
  `CorsProperties` passaram a permitir as origens do painel por ambiente. Sem isso, nenhuma
  chamada do painel funcionava (achado na verificação E2E do login).
- **Layout da marca (#145):** Tailwind v4 com tokens da paleta "Clinical Sanctuary" em
  `@theme`, logo do sistema, fontes Manrope/Inter; login e shell interativos.
- **E7-01 login (#145):** enforce **ADMIN-only** (o painel só aceita `papel === ADMIN`,
  inverso do app), guard de rota, interceptor JWT, `TokenStorage`. Verificado E2E pelo PO.
- **E7-09 (parcial) shell (#147):** topbar + navegação lateral com rotas filhas sob o guard.
- **E7-02 listar (#147 + #150 + #151):** página com tabela, busca, paginação; passou a
  consumir o endpoint admin `GET /api/v1/admin/hospitais` (namespace ADMIN, #150) que lista
  inativos. Verificado E2E (TODOS 340 · INATIVOS 0 · sem token 401).
- **E7-03 (parcial) filtros (#148 + #151):** nome, tipo e status; falta região.

### Segurança de sessão (ADR-013)

O PO levantou (25/09) a visibilidade de senha/token no DevTools. Registrado que **não é
vazamento** (DevTools da própria máquina; TLS+HSTS na rede; nada logado — verificado), e
decidida a direção de endurecimento: **refresh token em cookie HttpOnly** + access token só
em memória, sequenciada e a detalhar deploy (mesmo domínio ou BFF/proxy).

### Verificação

- Frontend: **23 testes (Vitest) verdes**, `ng build` limpo, telas conferidas no preview.
- Backend (outras sessões): CORS e listagem admin cobertos por testes MockMvc/integração.
- Revisão do diff antes do merge, com os achados baixos tratados.

---

## M-024 — Feedback pós-saída: piso de 2 min, pedido em 1 min e deep-link da notificação

**Data:** 28/09/2026 · **PR:** #163

### Como apareceu

Relato do PO com quatro comportamentos do fluxo de feedback após check-in/checkout
(manual e por geolocalização, em estados anônimo e logado):

1. A pesquisa era enviada mesmo para quem ficou **menos de 2 min** na unidade.
2. A notificação demorava **~5 min** (percebido como 5–10 min), não os 1–5 previstos.
3. Após "Fechar tudo", tocar a notificação abria a **tela inicial** em vez do feedback.
4. Com o app aberto numa tela qualquer, tocar a notificação **não redirecionava**.

### Causa

1. `agendarFeedback` não olhava a duração da visita — RN-01/RN-07 (visita < 2 min não
   convida, mesmo corte da agregação do backend) não era aplicado no cliente.
2. O atraso usava `visitaId.length % 5`; como o ObjectId do Mongo tem sempre 24
   caracteres, `24 % 5` dava 4 para toda visita e travava o atraso no teto de 5 min.
3. `addNotificationResponseReceivedListener` não recebe a resposta que **inicia** o app
   do zero — ela chega por `getLastNotificationResponseAsync`, que não era lido.
4. O handler fazia `await agendarLembrete(...)` **antes** do `navigate`: uma falha no
   agendamento impedia a navegação.

### O que mudou

- **Piso de 2 min:** `agendarFeedback` recebe a duração e não agenda abaixo do piso;
  online vem da resposta do checkout (`duracaoMinutos`), offline é calculada da entrada
  (util `duracaoMinutosDesde`, arredondado para casar com o inteiro do backend). Vale
  para `HospitalDetalheScreen` (manual) e `GeofencingTaskService` (geofence).
- **Pedido em 1 min:** por decisão do PO (28/09/2026), o convite passou de 1–5 min para
  **1 min fixo** após a saída; o espalhamento por id foi removido (sem propósito com valor
  fixo, e a idempotência do reagendamento se mantém).
- **Cold start:** `App.js` trata `getLastNotificationResponseAsync` no mount e despacha a
  navegação no `onReady` do `NavigationContainer`.
- **Foreground:** a navegação passa a vir **antes** do lembrete, que vira efeito colateral
  tolerante a falha.
- Reidratação: `HomeScreen` passa a `entrada` ao `sincronizarVisitaAtiva`, para o checkout
  offline por geofence ter a duração após reinício do app.

### Verificação

- **420 testes (Jest) verdes**, com casos novos para cada correção; lint no teto (16
  warnings pré-existentes, 0 erros).
- Revisão do diff antes do PR, com os achados tratados (util compartilhado, wire da
  entrada, arredondamento) ou justificados.
- Ressalva: a confirmação do fix 4 em aparelho físico (toque com o app aberto) depende de
  dispositivo/emulador; os demais são cobertos por teste.

---

## M-025 — Edição de geofence no painel (E7-06) e o reconciliador que a desfaria

**Data:** 28/09/2026 · **PR:** (este PR)

### Como apareceu

Ao desenhar a edição do raio do geofence na E7-06, a primeira ideia foi gerar o círculo
novo exatamente como o backend gera (32 lados). Lendo o `ReconciliacaoRaioGeofenceRunner`
(BUG-08), ficou claro que isso não sobreviveria: ele roda **a cada startup**
(`app.geofence.reconciliacao.enabled=true` em todos os ambientes) e regrava todo círculo
regular de 32 lados cujo raio difere do raio da categoria. No Cloud Run, startup = cold
start, então o raio escolhido pelo administrador voltaria sozinho ao padrão pouco depois
de salvo, sem erro nem log visível para quem editou.

### O que mudou

- O painel gera o círculo com **48 lados** (`LADOS_CIRCULO_ADMIN`): o reconciliador o trata
  como polígono próprio e o preserva, que é exatamente a regra já documentada nele
  ("contorno do administrador vale mais que o círculo da categoria").
- Sem mudar o raio, o polígono atual é reenviado intacto; um contorno desenhado à mão não é
  trocado por círculo só porque o nome foi editado.
- Quando o admin troca só a categoria de um hospital com o círculo padrão, a tela avisa que
  o raio passa a seguir o padrão da nova categoria no próximo startup (comportamento do
  reconciliador, agora explícito para quem edita).

### Achados do code-review aplicados no mesmo PR

- Raio medido fora da faixa 30–1000 m (contorno à mão) travava o formulário inteiro; a faixa
  passou a valer só para um raio **novo**. Causa extra: `[min]`/`[max]` no `<input
  type="number">` ativam os validadores de diretiva do Angular por conta própria.
- CNPJ gravado só com dígitos (importação CNES) reprovava a máscara e impedia salvar; agora
  é aceito e enviado mascarado.
- Resposta do PUT que chegasse após sair da tela (cold start de ~15 s) arrastava o usuário
  de volta ao detalhe; a assinatura passou a morrer com o componente.
- A prévia do mapa não se reenquadrava e cortava tiles dentro da animação de entrada; o
  setup do Leaflet (tiles OSM, z19, `ResizeObserver`) virou `criarMapaBase`, compartilhado
  com a página do mapa.

### Verificação

- 72 testes (Vitest) verdes e `ng build` limpo. Mutações conferidas: voltar para 32 lados,
  retirar o `takeUntilDestroyed` do PUT e reaplicar a faixa ao raio original fazem os
  testes correspondentes falharem.
- Pendente: verificação E2E com login ADMIN real contra o backend de dev.

---

## M-026 — Mapa do painel vazio após 15 min e divisões pouco legíveis

**Data:** 28/09/2026 · **PR:** (este PR)

### Como apareceu

No E2E local do Épico 7, o PO abriu o mapa do painel e não viu nenhum hospital, nem
uma divisão clara entre as regiões. A aba de rede mostrou a causa dos hospitais sumidos:
`GET /api/v1/admin/hospitais` → **401**. O access token vive 15 min e o painel nunca o
renovava; passado esse tempo, o guard seguia deixando entrar (havia token guardado), toda
chamada voltava 401 em silêncio e as telas ficavam vazias (o dashboard mostrava "—").

### O que mudou

- **Sessão:** o `authInterceptor` trata o 401 da API renovando o par com
  `POST /api/v1/auth/refresh` (já existia no backend, com rotação) e repete a chamada uma
  vez. Chamadas que recebem 401 juntas compartilham uma única renovação: como o backend
  revoga o refresh anterior na rotação, um segundo `/refresh` com ele derrubaria a sessão
  recém-renovada. Se o refresh for recusado (401/403), a sessão é encerrada e o login abre
  com "Sua sessão expirou"; falha de rede ou 5xx (ex.: 503 do cold start) não desloga.
- **Mapa:** os estabelecimentos passam a ser coloridos por **categoria**, na mesma divisão
  das camadas de pontos da base `multiplas_camadas_saude_14` que gerou o seed (Hospitais,
  UPA, UBS, Policlínicas, CAPS, Centros especializados, Outras unidades), cada uma com
  toggle e contagem; inativos em cinza. As divisões abrem com a **Região Administrativa
  ligada**, cada área com preenchimento próprio, contorno mais forte e nome ao passar o
  mouse (fixo nas camadas de poucas áreas: Região e Macrorregião de Saúde). Os marcadores
  ganharam um pane acima das áreas: antes, uma camada ligada depois deles era desenhada
  por cima e tomava o clique.

### Verificação

- 100 testes (Vitest) verdes e `ng build` limpo. Seis mutações mortas: sem a renovação
  compartilhada, sem a exceção das rotas de auth (laço de refresh), sem o logout na recusa,
  com logout em 503, sem o fallback de categoria e com o toggle de categoria que não remove.
- Na tela (backend local contra o banco de dev): sessão vencida → `POST /auth/refresh` 200 →
  chamada repetida 200 e os 340 estabelecimentos no mapa; refresh inválido → login com o
  aviso de sessão expirada.
- Teste de regressão `sessao-vencida.spec.ts`, pedido pelo PO: sobe os providers reais do
  `appConfig` (não dublês) e cobre token vencido → refresh → chamada repetida, as 4 páginas do
  mapa vencendo juntas com um único refresh, refresh recusado, 503 no refresh e ausência de
  laço. Com o interceptor anterior (o código do bug) ou sem o interceptor no `appConfig`, os
  5 casos falham. Suíte: 105 testes verdes.
- A cobertura do `admin/` não foi medida: `@vitest/coverage-v8` não está instalado no painel.

---

## M-027 — Massa de dados de avaliações para o ambiente de desenvolvimento

**Data:** 29/09/2026 · **PR:** (este PR)

### Como apareceu

Pedido do PO: testar avaliações de hospitais, a visualização das avaliações e o ranking
no ambiente de desenvolvimento. O banco de dev não tinha visitas nem avaliações
suficientes — todo hospital aparecia com "indicadores indisponíveis" (RN-15 exige 5
avaliações) e o ranking era só a lista em ordem alfabética.

### O que mudou

- Novo `MassaAvaliacoesRunner` (backend): 30 usuários de teste, ~890 visitas e ~850
  avaliações em 50 hospitais, com perfis de qualidade (excelente, bom, regular, ruim e
  poucas avaliações) para o ranking ter diferenças claras por nota e por tempo, e os
  demais hospitais sem avaliação. Os agregados são recalculados ao final da carga.
- Três travas contra homologação/produção: perfil Spring `dev`, flag
  `app.massa-avaliacoes.enabled` (padrão `false`) e nome do banco (precisa conter `dev` ou
  `test` e não conter `hom`/`prod`). Idempotente pelo prefixo `massa-dev-` nos `_id`; a
  cada boot recalcula os agregados, e a massa se regera sozinha com mais de 30 dias. Falha
  na carga não derruba a aplicação.
- `cd-backend-google.yml` liga o perfil `dev` e a flag só no serviço de dev.
- Como usar, senha dos usuários de teste e remoção:
  [`07-dados/Massa-Dados-Avaliacoes-Dev.md`](../07-dados/Massa-Dados-Avaliacoes-Dev.md).

### Verificação

- 26 testes unitários novos (gerador e runner): distribuição dos perfis, médias em ordem,
  regras do formulário (RN-10), vínculo avaliação → visita finalizada, janela de 90 dias,
  travas de banco, idempotência, validade de 30 dias, carga interrompida, `recriar`, senha
  aplicada e retirada depois da carga, e falha do banco sem derrubar a aplicação.
- Teste de integração com Mongo real (Testcontainers, roda no CI): ranking por nota e por
  tempo ordenado com hospitais sem indicadores no fim, login de usuário de teste com
  histórico de avaliações e segunda execução sem duplicar nada.

### Correção pós-merge (29/09/2026)

O primeiro deploy do dev com a massa (#171) falhou no smoke test: `/actuator/health`
respondeu 503 (`OUT_OF_SERVICE`) nas 6 tentativas. A carga era um `ApplicationRunner`, e o
readiness só fica pronto depois de todos eles; no Cloud Run a CPU fora de requisição é
mínima depois que a porta abre, então a carga (inserções + recálculo de 50 agregados no
Atlas) não terminava dentro da janela do smoke test. A carga passou a rodar em segundo
plano (`@Async` no `ApplicationReadyEvent`), fora do caminho de startup; teste de
regressão garante que ela não volte a ser `ApplicationRunner`.

---

## M-028 — Check-in e check-out automáticos com o app fechado

**Data:** 04/10/2026 · **PR:** (este PR)

### Como apareceu

Teste de campo do PO no Hospital Regional de Ceilândia (03/10/2026), mais de duas horas
no hospital: a entrada na zona do hospital não foi registrada com o app fechado e só
aconteceu quando o app foi aberto. O check-out tinha a mesma dependência.

### Causas

1. **O APK não podia pedir localização em segundo plano.** O APK é gerado pelo Gradle a
   partir do `frontend/android/` versionado, sem `expo prebuild`. As permissões
   `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE` e `FOREGROUND_SERVICE_LOCATION`
   estavam só no `app.json` e nunca chegaram ao `AndroidManifest.xml`. Sem elas, o
   Android nega o pedido da permissão "o tempo todo" na hora, e o geofencing nativo nem
   chegava a ser ligado.
2. **A tolerância de 2 min (RN-01) e de 5 min (RN-03) era um `setTimeout` em memória.** O
   SO acorda o app no evento da região, mas o iOS o suspende em segundos e o Android
   congela ou mata o processo bem antes dos 2 minutos. O timer só disparava quando o
   usuário abria o app.
3. **A visita ativa ficava só em memória.** Uma saída entregue a um processo novo não
   encontrava a visita e não fazia o checkout.

### O que mudou

- `AndroidManifest.xml` com as três permissões. No `app.json`, o plugin do
  `expo-location` passa a habilitar o modo de localização em segundo plano do iOS
  (`UIBackgroundModes: location`) e o serviço em primeiro plano do Android.
- Estado do geofencing (visita ativa e entradas/saídas aguardando a tolerância) salvo no
  AsyncStorage, com gravações em série. Só ids e instantes: nenhuma coordenada fica em
  disco.
- Durante a tolerância, o app liga atualizações de localização em segundo plano. No
  Android isso aparece como uma notificação fixa: "Confirmando sua chegada ou saída do
  hospital". O acompanhamento é desligado assim que nada está pendente; fora dessas
  janelas, quem vigia é o geofencing nativo, de baixo consumo. Cada leitura, cada evento
  e a abertura do app confirmam o que já venceu.
- Monitora os 19 hospitais mais próximos mais uma região de recálculo em volta do
  usuário (o iOS aceita no máximo 20 regiões). Quando o usuário sai dela, a lista é
  refeita em segundo plano.
- Antes de pedir a permissão "o tempo todo", o app explica para que ela serve
  (divulgação exigida pelo Google Play). Se o usuário recusar, o app não insiste por 3
  dias.
- Uma entrada sem sinal de GPS volta para a fila por até 30 min em vez de se perder. Uma
  saída antiga de um hospital não encerra a visita de outro. Um checkout que recebe 404
  ou 409 esquece a visita local. Um logout no meio de um check-in não regrava a visita.
- A Home só sincroniza a visita com o geofencing a partir de uma resposta do servidor:
  uma falha de rede não apaga mais a visita guardada.

### Verificação

- 29 testes novos no `GeofencingTaskService` (de 9 para 38), que agora tem 96% de cobertura de linhas.
  Os cenários de segundo plano simulam a morte do processo: os timers somem, o módulo é
  recarregado do zero e o tempo avança. Também foram adicionados testes da Home.
- Exige um **build nativo novo** (APK do CD ou dev build). O Expo Go não roda tarefas de
  localização em segundo plano. No aparelho, é preciso conceder a localização
  "Permitir o tempo todo".

---

## M-029 — Avaliação da visita pendente até 24h (sem depender da notificação)

**Data:** 04/10/2026 · **PR:** (este PR)

### Como apareceu

Pedido do PO: o feedback deveria ficar pendente para o usuário que não conseguiu responder
na hora ou ficou com o celular descarregado.

### Causas

1. **A notificação era o único caminho até o formulário.** Quem dispensava ou não via a
   notificação não tinha onde avaliar dentro do app.
2. **Só existia uma pendência por vez.** Uma segunda visita no mesmo dia apagava a
   pendência da primeira.
3. **O lembrete único (E3-03) nunca chegava.** Ao gravar a pendência, o app cancelava o
   lembrete que tinha acabado de agendar. Além disso, ele só era agendado quando o usuário
   tocava no primeiro pedido, ou seja, quem não viu o pedido ficava sem lembrete.
4. **Celular descarregado dentro do hospital perdia a avaliação.** Sem sinal por 10 min, o
   backend encerra a visita como `GPS_INTERROMPIDO` (RN-06). O app nunca passava pelo
   checkout, então não agendava nada, e o `POST /feedbacks` só aceitava `FINALIZADA`.

### O que mudou

- **App:** cada visita encerrada vira uma pendência gravada no AsyncStorage (sobrevive ao
  app fechado e ao celular desligado) até ser respondida, dispensada ou completar 24h após
  a saída (RN-09). A pendência é gravada antes de qualquer chamada de notificação, então
  uma falha de permissão ou de agendamento não a apaga. A pendência antiga (chave única)
  é migrada.
- **Home:** card "Avaliação pendente" com o hospital, o prazo ("Responda até hoje às
  14:30"), o botão "Avaliar" e "Agora não". Some quando não há pendência.
- **Lembrete:** pedido (1 min) e lembrete único (+6h) agendados juntos na saída.
- **Servidor:** novo `GET /api/v1/contas/feedbacks/pendentes` (logado) com as visitas que
  ainda aceitam feedback. O app soma essas visitas à lista local, o que cobre o celular que
  apagou dentro do hospital e o app reinstalado, e agenda o lembrete delas se a notificação
  já estiver permitida.
- **Regra:** `POST /feedbacks` aceita visita `GPS_INTERROMPIDO` e recusa (404) a visita com
  a janela de 24h vencida. Antes, a visita seguia avaliável até a próxima passada do job
  `SEM_FEEDBACK`.
- **Privacidade:** logout e exclusão de conta apagam as pendências do aparelho, porque o
  hospital visitado é dado de saúde (LGPD, art. 11).

### Verificação

- Backend: 6 testes novos no `FeedbackServiceImplTest` e 1 no `ContaControllerTest`.
- Frontend: `FeedbackNotificationService.test.js` reescrito (24 testes), novo
  `FeedbacksPendentesCard.test.js` (12) e testes de logout no `LoginService`. Suíte: 479
  testes passando.
- O `code-review` do diff apontou 10 achados, e 9 foram corrigidos neste PR: corrida do
  logout com a sincronização, pendência perdida quando o agendamento falha, 404 da fila
  offline apagando a pendência, NPE com hospital sem nome, notificação de visita
  dispensada reabrindo o formulário, visita do servidor sem lembrete, nome genérico
  migrado, prazo calculado em três lugares e consulta ao servidor a cada foco. Ficou de
  fora só a duplicação da busca de nomes de hospital, que já existia no serviço de visitas.

---

## M-030 — Trava de contagem de testes e SonarQube Cloud na esteira

**Data:** 04/10/2026 · **PR:** (este PR)

### Como apareceu

Pedido do PO: "a quantidade de testes não pode ser menor ou igual ao cenário de testes
anterior, e isso a esteira deve avaliar", e configurar o Sonar gratuito no mobile, no admin
e no backend.

### O que mudou

- **Trava de contagem de testes** (job `Trava de contagem de testes` do `ci.yml`, só em PR).
  Cada job de área conta os testes **executados** no relatório real da execução (XML JUnit
  no backend, `--json` do Jest no frontend, reporter `json` do Vitest no admin) e publica a
  contagem como artefato. O job da trava compara com a contagem do CI de push do commit da
  base contra o qual o PR rodou (o primeiro pai do merge commit do PR; se esse CI não
  estiver verde, o ancestral verde mais próximo, com aviso). Comparar com o "último CI
  verde" da branch, achado do `code-review`, misturaria código diferente num re-run.
  Regra:
  - área cujo código de produção o PR altera: a contagem precisa **subir**;
  - demais áreas: a contagem **não pode cair** (PR só de documentação ou de workflow não
    tem teste a acrescentar numa área que não tocou).
  - Teste ignorado (`@Disabled`, `it.skip`, `it.todo`) não conta: trocar um teste por um
    skip reprova.
  - "Código de produção" segue o recorte da cobertura de cada área: `backend/src/main/java`,
    `frontend/src` + `App.js` sem `__tests__`, `css` e `theme`, `admin/src/app` (`.ts` e
    `.html`, sem `.spec.ts`) + `admin/src/main.ts`.
  - Sem contagem na base (primeira execução, ou base sem CI verde há mais de 90 dias, a
    retenção do artefato), a trava só registra e avisa.
- **SonarQube Cloud** (plano gratuito; o repositório é público, então não há limite de
  linhas). Três projetos, um por área, analisados no próprio `ci.yml` depois dos testes:
  backend pelo plugin Gradle `org.sonarqube` com a cobertura do JaCoCo, frontend e admin
  pela `sonarqube-scan-action` com o `lcov`. O admin passa a medir cobertura
  (`@vitest/coverage-v8`; sem piso por enquanto, 92% de linhas na medição de hoje).
  A análise só roda quando o secret `SONAR_TOKEN` existe: até o PO configurar, o passo
  é pulado sem reprovar o CI. Passo a passo em `10-git-flow/MANUAL.md` §4.4.
- `checkout` com histórico completo nos três jobs: o Sonar usa o blame para separar o
  código novo do antigo.

### Verificação

- Regras da trava exercitadas localmente (área alterada com contagem igual reprova, sem
  alteração e contagem igual passa, queda reprova, base ausente passa com aviso).
- Contagem real: admin 105 testes no `vitest.json`; backend lida do XML JUnit.
- `./gradlew help --task sonar` resolve o plugin; o `ng test` com cobertura e reporter
  `json` gera `coverage/admin/lcov.info` e `test-results/vitest.json`.
- A análise do Sonar não pôde ser executada fora do CI (a sessão não alcança o
  sonarcloud.io): a primeira execução real acontece no CI depois de o secret existir.

---

## M-031 — Cobertura mínima de 90% no código novo e cobertura total que não cai

**Data:** 04/10/2026 · **PR:** (este PR)

### Como apareceu

Pedido do PO: "os testes não devem ser aceitos como passed se o coverage estiver menos de
90%". Escolha do PO entre as opções apresentadas: **os dois** — 90% no código que o PR
altera e a cobertura total de cada área sem poder cair.

Exigir 90% no total já travaria todo PR de backend (78,8% hoje) e de mobile (83,6%) até
alguém escrever os testes que faltam no código antigo. Por isso o total funciona como
catraca: só sobe, até chegar à meta.

### O que mudou

- **90% no código novo** (passo "Cobertura do código novo (mínimo 90%)" em cada job de
  área do `ci.yml`, só em PR). O `diff-cover` cruza o relatório de cobertura da área
  (JaCoCo XML no backend, `lcov` no frontend e no admin) com as linhas alteradas pelo PR
  em relação à branch de destino e reprova abaixo de 90%. Área que o PR não altera passa
  sem medir.
- **Cobertura total que não cai** (job `Trava de contagem de testes`, agora "de contagem
  de testes e de cobertura"). O `contagem_testes.py contar` grava também a cobertura de
  linhas da área; o `comparar` reprova o PR que altera o código de produção da área e
  deixa a cobertura dela abaixo da base, com folga de 0,1 ponto. Área que o PR não altera
  só registra: achado do `code-review`, código dependente de tempo cobre uma linha a mais
  ou a menos entre execuções e reprovaria um PR de documentação. Na área que já passou de 90%, o piso é a própria meta:
  sem esse teto, código novo coberto a exatamente 90% baixaria um total de 95% e
  reprovaria um PR que cumpre a regra do código novo. Base sem cobertura registrada (CI
  anterior a esta mudança) só registra.
- O resumo do job mostra, por área, testes e cobertura da base e do PR.

### Verificação

- `diff-cover` exercitado localmente com o JaCoCo do backend (`--src-roots
  backend/src/main/java`) e com o `lcov` do frontend e do admin reescrito para caminhos
  relativos à raiz do repositório.
- Leitura da cobertura conferida nos três formatos (admin 92,33% no `lcov.info`).
- Na primeira execução real, a base ainda não tem cobertura registrada: a catraca do total
  só passa a valer depois do primeiro CI de push na `develop` com esta mudança.

---

## M-032 — Cliente HTTP único no app (Fase 0 da SDD de TanStack Query e Zustand)

**Data:** 05/10/2026 · **PR:** (este PR)

### Como apareceu

A Auditoria Técnica v4.0 do app e a SDD de adoção de TanStack Query e Zustand
(`08-analise tecnica/`) puseram como pré-requisito unificar o cliente HTTP. Conferido
contra a `develop` em `08-analise tecnica/Conferencia-Auditoria-v4-e-SDD.md`:

1. **Cinco cópias do mesmo `request()`.** `HospitalService`, `VisitaService`,
   `FeedbackService` e `PerfilService` tinham cada um o seu, e o `HospitalService` lançava
   erro sem `status` nem `data`: um 404 era indistinguível de um 500 no domínio mais
   consultado do app.
2. **Exclusão de conta sem renovação do token (LGPD, F0-05).** `LoginService.excluirConta()`
   tinha a quinta cópia, sem o tratamento de 401: com o access token vencido (15 min), a
   exclusão falhava com "Sessão expirada" mesmo com refresh token válido.
3. **Ciclo de import.** Os serviços importavam o `LoginService` para o interceptor 401, e o
   `LoginService` importava o `GeofencingTaskService`, que importa `HospitalService` e
   `VisitaService`.

### O que mudou

- `frontend/src/core/api/apiClient.js`: `apiRequest` com `Authorization`, timeout e retry
  (`fetchComRetry`), renovação em 401 com a coordenação por geração de `config/sessao.js`,
  `signal` para cancelamento e `idempotente`. Erros fora de 2xx viram `ApiError
  { status, data, message }` (`core/api/apiError.js`).
- Os quatro serviços e a exclusão de conta passam a usar o cliente único. O download do
  PDF de exportação (binário) reaproveita a mesma renovação.
- O `apiClient` não importa o `LoginService`: o refresh e o logout são registrados por
  `core/api/sessaoApi.js`, carregado no `index.js` antes das tarefas de geofencing. O ciclo
  de import acabou.
- ADR-001 passa a "Implementado". A auditoria v4.0, a SDD e a conferência entram no
  repositório em `08-analise tecnica/`.

### Verificação

- `apiClient.test.js` (16 testes): contrato do `ApiError`, `signal`, `idempotente`,
  renovação, encerramento só quando o servidor rejeita o refresh, falha de rede
  classificada.
- `LoginService.test.js`: exclusão de conta com token vencido renova e conclui; com refresh
  rejeitado, encerra a sessão. `HospitalService.test.js`: erro da API com `status`.
- Suíte do app: 489 → 508 testes, todos passando. Linhas alteradas com 100% de cobertura
  (`diff-cover`). Lint sem aviso novo (16).

---

## M-033 — Sessão global e cache de queries no app (Fase 1 da SDD de TanStack Query e Zustand)

**Data:** 05/10/2026 · **PR:** (este PR)

### Como apareceu

Auditoria Técnica v4.0, §4.2.2: o usuário logado era relido do AsyncStorage no foco de
cada tela. Quando o interceptor 401 encerrava a sessão, nenhuma tela era avisada: o
Perfil continuava mostrando a conta até o próximo foco. O Histórico refazia as duas
consultas a cada foco, sem cache.

### O que mudou

- **Sessão global** (`core/stores/sessaoStore.js`, Zustand): o `LoginService` grava o
  usuário a cada login, renovação, logout e exclusão de conta, e o app hidrata o store do
  `TokenStorage` ao abrir. Perfil e Histórico leem dali e reagem na hora, inclusive ao
  logout feito pelo interceptor 401. Sem persistência própria: o `TokenStorage` continua
  sendo a única cópia no aparelho (correção à §6.4 da SDD, que gravava o usuário uma
  segunda vez).
- **TanStack Query** (`core/query/`): `QueryClient` com cache de 2 min, sem retry próprio
  (o `apiClient` já repete com backoff; somar os dois chegaria a 9 requisições), ligado ao
  foco do app (`AppState`) e à conexão (`expo-network`). Fábrica central de chaves.
- **Logout limpa só o dado pessoal do cache** (`visitas` e `conta`); o catálogo público de
  hospitais fica.
- **Histórico** passa a usar `useQuery`, com a chave por usuário e recarga ao voltar à tela
  (só com sessão: o `refetch` do TanStack Query ignora o `enabled`).
- Perfil e Histórico esperam o app ler o usuário gravado antes de decidir que é anônimo,
  para não piscar o convite ao login para quem já está logado.
- ADR-004 (Context API) marcado como substituído.

### Verificação

- Testes novos: `sessaoStore` (7), `queryClient`/`queryKeys` (7), `setupQueryClient` (7),
  `useRecarregarNoFoco` (2), Perfil (5: conta da sessão, sem piscar o convite ao login
  antes de ler o usuário gravado, logout pelo interceptor, Sair, exclusão), Histórico (4:
  logout com a tela aberta, sem consultar a API antes de ler o usuário, erro e nova
  tentativa, erro sem mensagem), `LoginService` (sessão em dia no login, renovação e logout) e `signal` no
  histórico dos dois serviços.
- Suíte do app: 508 → 543 testes. Linhas alteradas com 98% de cobertura (`diff-cover`;
  das 3 linhas sem cobertura, 2 são o `onReady` do `App.js`, só reindentado). Lint sem aviso
  novo (16).

---

## M-034 — Heartbeat e geofencing seguem a visita ativa em qualquer tela (Fase 2 da SDD)

**Data:** 05/10/2026 · **PR:** (este PR)

### Como apareceu

Auditoria Técnica v4.0, §4.2.2, confirmada no código: quem alimentava o heartbeat
(E2-09) e o `sincronizarVisitaAtiva` do geofencing era só a Home, e só quando a aba
Início ganhava foco. Sequência real do defeito: abrir o app, ir para Hospitais, fazer
check-in manual e seguir para o detalhe sem voltar ao Início. O heartbeat nunca
começava, e o geofencing não conhecia a visita para o checkout automático. No caminho
inverso, um checkout manual no detalhe deixava o heartbeat da visita encerrada rodando
até o próximo foco da Home.

### O que mudou

- **`VisitaAtivaSync`** (`screens/visitas/hooks/`), montado na raiz do `App.js`: observa
  a query compartilhada da visita ativa (`useVisitaAtiva`, chave por usuário, fresca por
  30 s) e liga ou desliga o heartbeat e o `sincronizarVisitaAtiva` em qualquer tela. O
  geofencing nativo também passa a ser iniciado ali.
- Mantém as regras que a Home já seguia: só sincroniza com resposta do servidor (o dado
  indefinido da abertura não apaga a visita guardada pelo geofencing), falha de rede não
  para o heartbeat, e erro real do servidor para o heartbeat sem apagar a visita guardada.
  Entrada e hospital continuam indo junto (a SDD repassava só o id).
- Check-in manual na lista, checkout manual no detalhe, check-in e checkout automáticos do
  geofencing com o app aberto e o envio da fila offline marcam a visita ativa como
  desatualizada (`invalidarVisitaAtiva`), e o observador segue a visita nova na hora. A volta do app ao primeiro plano também recarrega a visita
  (`refetchOnWindowFocus`).
- A Home volta a ser só apresentação.
- Fora do escopo: o polling de 60 s da visita ativa proposto na SDD (uma requisição por
  minuto por usuário, sem ganho para um heartbeat de 30 min).

### Verificação

- `VisitaAtivaSync.test.js` (8 testes), incluindo o cenário do defeito (check-in em outra
  aba liga o heartbeat) e o checkout manual parando o heartbeat. Os 4 testes de visita da
  Home migraram para lá; a Home ficou com 1 teste de apresentação. No
  `GeofencingTaskService.test.js`, check-in e checkout automáticos avisam o observador.
- Suíte do app: 543 → 549 testes. Linhas alteradas com 100% de cobertura (`diff-cover`).

---

## M-035 — Leituras de hospitais com TanStack Query (Fase 3 da SDD)

**Data:** 05/10/2026 · **PR:** (este PR)

### Como apareceu

Auditoria Técnica v4.0 e SDD (§2, item 2): Hospitais, Ranking e Mapa controlavam a
paginação e as corridas entre respostas com refs manuais (`geracaoRef`,
`buscandoMaisRef`, `cargaEmAndamentoRef`), e o Detalhe buscava hospital e indicadores
em sequência, sem cache. Voltar a uma tela já vista refazia todas as chamadas.

### O que mudou

- **`screens/hospitais/hooks/useHospitais.js`**: `useHospitaisLista` e
  `useRankingHospitais` (`useInfiniteQuery`), `useHospital` e `useIndicadoresHospital`
  (`useQuery`) e `useHospitaisMapa`. Cada busca, filtro, ordem ou raio é uma chave
  própria: a resposta de um critério antigo é descartada pela biblioteca e a requisição
  é cancelada pelo `signal`, o que elimina as três refs.
- `HospitalService.listar`, `ranking`, `buscarPorId` e `buscarIndicadores` aceitam
  `signal`.
- **Hospitais:** a busca vai à consulta 400 ms depois da última tecla, normalizada e
  filtrada de novo no cliente, como antes. O destaque do check-in ativo usa a mesma
  chave do Detalhe, então abrir o detalhe desse hospital não repete a chamada.
- **Ranking e Hospitais:** `fetchNextPage` com `cancelRefetch: false`, para que dois
  `onEndReached` seguidos não peçam a mesma página duas vezes.
- **Detalhe:** hospital e indicadores em paralelo; se os indicadores dedicados falharem,
  continua valendo o fallback embutido. Uma atualização que falha com o hospital já na
  tela não troca a tela pelo erro.
- **Mapa:** o catálogo continua vindo em lotes de 100, agora pelas páginas da consulta.
  Uma falha no meio mantém os lotes já carregados, mostra o aviso e não repete sem fim.
  A posição do recorte por raio é fixada ao escolher o raio, como antes.
- Ficam para a Fase 4: a visita ativa que Hospitais e Detalhe ainda consultam por conta
  própria e as mutações de check-in, checkout e feedback.

### Verificação

- Os testes de corrida que protegiam as refs (refresh com página em voo, troca de
  filtro com página antiga chegando depois, dois `onEndReached` seguidos) continuam
  passando sem as refs. O de `onEndReached` pegou o `cancelRefetch` padrão.
- Novos: `useHospitais.test.js`, `signal` no `HospitalService`, refresh e rodapé do
  Ranking, erro e busca normalizada em Hospitais, atualização com falha no Detalhe e
  página do meio com falha no Mapa.
- Suíte do app: 549 → 564 testes. Linhas alteradas com 100% de cobertura (`diff-cover`).

---

## M-036 — Check-in, checkout e feedback com mutações (Fase 4 da SDD)

**Data:** 05/10/2026 · **PR:** (este PR)

### Como apareceu

Depois da Fase 3, Hospitais e Detalhe ainda consultavam a visita ativa por conta própria
a cada foco (três consultas da mesma visita com o `VisitaAtivaSync`), guardavam cópias
locais dela e chamavam o `VisitaService` direto para check-in e checkout. O envio do
feedback também não avisava o cache, e o histórico da conta podia mostrar a lista sem a
avaliação recém-enviada.

### O que mudou

- **`useCheckinManual` e `useCheckoutManual`** (`screens/visitas/hooks/useMutacoesVisita.js`):
  ao confirmar, gravam a visita só na chave da visita ativa do usuário e pedem a
  confirmação ao servidor. Nada é escrito em `visitas.all` (defeito 5 da conferência).
  O `VisitaAtivaSync` reage na hora: liga ou desliga o heartbeat e avisa o geofencing.
- **`useVisitaAtivaDaTela`**: Hospitais e Detalhe leem a mesma query do observador
  global, recarregada ao voltar para a tela. Mantém as regras de antes: sem conexão
  fica a última visita conhecida, erro real do servidor mostra "sem visita", e um
  check-in ou checkout guardado na fila offline vale na tela até a próxima resposta do
  servidor. Esse estado otimista fica na tela, fora do cache, para o observador não
  parar o heartbeat por causa de uma visita sem id.
- **`useEnviarFeedback`**: POST na criação e PUT na edição. Depois de gravar, o
  histórico da conta é marcado como desatualizado.
- Não entrou: a troca de `FlatList` por `FlashList` citada na SDD. É uma dependência
  nova de renderização de lista, sem relação com o estado do app, que pede validação de
  desempenho no aparelho; fica para um PR próprio.

### Verificação

- `useMutacoesVisita.test.js` (6 testes): chave certa no check-in sem tocar outra query
  do domínio, checkout, falha sem efeito no cache, estado otimista até a próxima
  resposta, nada antes de ler a sessão e o feedback com POST/PUT.
- Detalhe: voltar à tela sem conexão depois de um checkout enfileirado não traz o
  cronômetro de volta.
- Testes de tela ajustados ao servidor real: depois do check-in ou checkout, a próxima
  consulta da visita ativa responde com o estado novo.
- Suíte do app: 564 → 570 testes. Linhas alteradas com 100% de cobertura (`diff-cover`).

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
