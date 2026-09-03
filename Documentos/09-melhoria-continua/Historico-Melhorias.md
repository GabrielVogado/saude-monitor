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

## Pendências abertas

| # | O que | Origem | Estado |
|---|---|---|---|
| **P-001** | ~~Reconstituir o **item 1** do Observer~~ — reconstituído em 03/09/2026 a partir do banco do claude-mem, com citação literal do PO. Ver [OBS-001](../../skill-observations/OBS-001-skill-pela-linguagem-do-arquivo.md) e M-001 acima. | PO | ✅ Fechada |
| **P-002** | O hook `SessionStart` só passa a valer **a partir da próxima sessão** (ou depois de abrir `/hooks` uma vez): o watcher de configuração só observa diretórios que já tinham arquivo de settings no início da sessão. | UPD-002 | 🟡 Ação do PO |
| **P-003** | 3 achados do `code-review` no portão de cobertura entregue por #60, fora do escopo de #63: (a) `frontend/jest.setup-after-env.js` — `asyncUtilTimeout: 5000` igual ao `testTimeout` padrão, então a folga nunca é usada e o erro vira "Exceeded timeout" opaco; (b) `frontend/jest.config.js` — `collectCoverageFrom` omite `App.js` (191 linhas, listeners de notificação), inflando a linha de base; (c) `PerfilScreen.test.js` — comentário justificativo factualmente errado sobre o que é pintado durante o carregamento. | `code-review` de 03/09/2026 | 🟡 Vira PR próprio |
| **P-004** | O git-flow documentado não é o do repositório. O `Documentos/git-flow/MANUAL.md` §3 descreve `feature/* → develop → main → release/<tag>`, com `main` = homologação. No `origin` existem **só `develop` e `master`**; não há branch `main`, não há nenhuma `release/*`, e o default do repo é `master`. Consequência: `develop` está **158 commits à frente** de `master`, cujo último merge foi o PR #10, em 19/08/2026 — 50 PRs entraram em develop desde então sem promoção, e nunca houve release. Ou o manual é corrigido para `master`, ou as duas etapas (hom e prod) precisam ser criadas. | Auditoria de PRs, 03/09/2026 | 🟡 Decisão do PO |
| **P-005** | A branch `feature/e8-01-migracao-cloud-run` tem o commit `d2aabc8` (626 linhas: workflow `cd-backend-cloudrun.yml`, `deploy/cloudrun/`, `application.properties`, `De-Para`) e **existe apenas na máquina local** — nunca foi enviada ao `origin`. A migração está parada **por decisão do PO** ("Não vamos migrar para o Google Cloud Run agora, vamos terminar de consertar o sistema. Irei pesquisar hospedagens melhores", 02/09 21:16), então não cabe PR. Cabe **push da branch como backup**, para o trabalho não depender de uma máquina só. Efeito colateral enquanto isso: o `De-Para` no `develop` ainda registra **Oracle Cloud** como alvo do E8-01, porque a correção está nesse commit não publicado. | Auditoria de PRs, 03/09/2026 | 🟡 Aguardando aval do PO |
