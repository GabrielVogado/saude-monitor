# UPD-003 — Portão verificável e correção do escopo de skills

- **Origem:** [OBS-003](../skill-observations/OBS-003-skill-anunciada-nao-e-skill-ativada.md)
- **Data:** 03/09/2026
- **Estado:** 🟡 Item 1 aplicado · itens 2 e 3 dependem do PO

## Problema a resolver

O [UPD-002](./UPD-002-matriz-de-roteamento-de-skills.md) resolveu **qual** skill
ativar e **quantas**. Não resolveu **como saber se foram ativadas** — e o texto da
matriz pedia literalmente *"anunciar quais skills foram ativadas"*, que é uma
instrução satisfeita por escrever uma frase.

O mesmo vale para o portão: `CLAUDE.md` manda rodar `code-review` antes de todo PR,
e nada no fluxo verifica que rodou. Três PRs saíram sem ele, custando 8 achados
encontrados só depois do merge.

> A lição do UPD-002 se repete aqui, um nível acima: **instrução sem gatilho não se
> aplica sozinha.** Lá o gatilho foi o hook `SessionStart`, que entrega a regra.
> Falta o gatilho que **cobra** a regra.

## 1. `lobehub-react` sai da matriz de `frontend/` — ✅ aplicado, com ressalva

Verificado no `package.json` do projeto: `@lobehub/ui`, `antd`, `antd-style`, `next`
e `react-router-dom` — **nenhuma existe**. A skill descreve um stack React web que
este repositório não usa; o projeto é Expo/React Native com React Navigation.

Move-se para a seção **"skills que NÃO se aplicam"**, junto de `quarkus` (o backend
é Spring Boot, não Quarkus) e `awesome-llm-apps-fullstack-developer` (não há camada
de LLM). > ⚠️ **A correção teve de acontecer em dois lugares, e só um deles é versionado.**
> A matriz **viva** — a que o hook `SessionStart` injeta em toda sessão — é
> `.claude/skills-roteamento.md`, que **não entra no repositório** por decisão do PO.
> Ela foi corrigida na máquina; o Anexo A do
> [`Historico-Melhorias.md`](../Documentos/09-melhoria-continua/Historico-Melhorias.md)
> é a cópia versionada e também foi.
>
> Isso expõe uma consequência da decisão de não versionar `.claude/` que não estava
> registrada: **toda alteração de regra passa a exigir dois passos, e um deles não é
> auditável em PR.** Se os dois divergirem, vale o que está na máquina — e ninguém
> descobre pelo repositório. O próprio `code-review` deste PR pegou a divergência,
> que teria feito a próxima sessão receber a regra antiga.

Com a saída dela, a coluna de complementares de `frontend/` fica só com `run`
(confirmar a mudança na tela real).

## 2. Trocar "anunciar" por "ativar" na redação — proposto

A matriz diz *"**Anunciar** quais skills foram ativadas e por quê, antes da primeira
edição"*. A palavra que carrega a obrigação é a errada: anunciar é o efeito
colateral, ativar é o ato. Redação proposta:

> **Invocar** a skill de cada área tocada antes da primeira edição, e dizer na
> resposta qual foi invocada e por quê. A invocação é o ato; a menção é o registro
> dela — nunca o substituto.

## 3. Gatilho que cobra o portão — proposto, decisão do PO

Um hook `PreToolUse` sobre o `Bash`, interceptando `gh pr create` e bloqueando
quando nenhum `code-review` rodou na sessão. É o mesmo desenho do `SessionStart` do
UPD-002: transferir a regra do documento para o harness.

**Custo:** ~30 linhas de Node, uma verificação por PR.
**Risco:** baixo — bloqueia um comando, não altera código.
**Reversão:** apagar o bloco `PreToolUse` do `settings.json`.

⚠️ **Depende de uma decisão do PO.** Por decisão de 03/09/2026, `.claude/` **não é
versionado** — o hook viveria apenas na máquina do PO e não valeria para mais
ninguém, nem seria auditável no repositório. As alternativas são:

- **(a)** aceitar o hook local, como o `SessionStart` já é hoje;
- **(b)** abrir exceção e versionar só os hooks, mantendo o resto do `.claude/` fora;
- **(c)** não usar hook e aceitar que o portão dependa de disciplina — sabendo que
  foi exatamente isso que falhou em três PRs seguidos.

Recomendo **(a)**: mantém a decisão sobre o `.claude/` intacta, e a regra fica
registrada no Anexo A, que é versionado.
