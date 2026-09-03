# OBS-001 — Skill escolhida pela proximidade da instalação, não pela linguagem do arquivo

- **Data do fato:** 02/09/2026, 20:25 (GMT-3)
- **Observador:** Gabriel Vogado (Product Owner)
- **Estado:** ✅ Aplicada — a regra entrou pela matriz do [UPD-002](../skill-updates/UPD-002-matriz-de-roteamento-de-skills.md)
- **Registro reconstituído em:** 03/09/2026

> ⚠️ **Este registro foi reconstituído a posteriori.** Na data do fato, as pastas
> `skill-observations/` e `skill-updates/` não existiam — nada foi persistido na
> hora. A reconstituição saiu do banco local do claude-mem, com a citação literal
> do PO. Ver **Proveniência** no fim.

## O que o PO observou

> "para as correções de back end não seria melhor chamar a skill de java ao invés
> da skill de expo?"

## O comportamento observado

Durante a execução do roadmap de melhorias (prompt anterior: *"execute por ordem de
prioridade sem quebrar o sistema, delegue as atividades para as skills que melhor
farão os papéis"*), o agente aplicava **`expo-skills`** de forma indiscriminada —
inclusive sobre correções de **backend**, que é Gradle + Spring Boot 4.0.4 sobre
Java 25, com MongoDB, Security, JWT, OpenPDF e Testcontainers.

A skill `java` existia e era adequada. Só não estava no lugar em que o agente
olhou.

## Causa

Duas causas somadas:

1. **Proximidade venceu adequação.** `expo-skills` era a única skill instalada no
   diretório **do projeto** (`D:\saude-monitor\.claude\skills`). A `java` estava no
   diretório **global** (`C:\Users\Gabriel\.claude\skills`), junto de `quarkus`,
   `software-architect`, `lobehub-react` e outras. O agente pegou a que estava à
   mão em vez da que servia ao arquivo.
2. **O `CLAUDE.md` da época não tinha mapa.** Mandava "delegar para o agente/skill
   **mais adequado**" sem dizer qual é o adequado para qual parte do sistema.
   "Adequado" sem critério é o agente decidindo por conta.

## Regra que sai disso

**A skill é escolhida pela natureza do arquivo tocado, não pela skill que está
instalada mais perto.** Correção em `backend/**/*.java` → `java`. Correção em
`frontend/` → `expo-skills`. O diretório em que a skill mora é irrelevante para a
escolha.

## Como foi aplicada

Não houve `UPD-001` próprio. A regra foi absorvida pela matriz criada em
[UPD-002](../skill-updates/UPD-002-matriz-de-roteamento-de-skills.md):

- linha **`backend/` → `java`**, que é literalmente esta observação virando tabela;
- seção **"skills que NÃO se aplicam"**, que impede a variante do mesmo erro —
  ativar `quarkus` por semelhança de "backend Java", quando o backend é Spring Boot.

[OBS-002](./OBS-002-ativacao-de-skills-por-dominio.md) é a continuação desta: o item 1
corrigiu **qual** skill; o item 2 corrigiu **quantas** (uma por área tocada, não uma
por tarefa).

## Por que o registro atrasou

O item 1 aconteceu em 02/09. As pastas do ciclo nasceram em 03/09, no commit
`3d2b9e6`. Verificado: `git log --all -- CLAUDE.md .claude/` devolve **apenas os dois
commits de 03/09** — o item 1 não gerou PR, não gerou commit, não deixou rastro no
repositório. O `CLAUDE.md` da época existia só como arquivo não versionado na máquina
do PO, editado por ele mesmo ("o arquivo CLAUDE.md foi atualizado com o caminho
correto das skills", 02/09 19:41), e foi sobrescrito pela reescrita do item 2.

## Proveniência da reconstituição

Banco local do claude-mem (`~/.claude-mem/claude-mem.db`):

| Fonte | Registro | Timestamp (UTC) |
|---|---|---|
| `user_prompts#63` | A citação literal acima | 2026-09-02T23:25:33Z |
| `observations#712` | ⚖ *"User directs Java skill for backend fixes instead of Expo skill"* | 2026-09-02T23:25:37Z |
| `observations#713` | Inventário: projeto só tem `expo-skills`; `java` está no global | 2026-09-02T23:25:43Z |
| `observations#714` | `java` cobre Spring/Gradle/JVM — adequada ao backend do projeto | 2026-09-02T23:25:55Z |

**Como foi descartada a ambiguidade:** os 75 prompts do histórico foram filtrados por
`skill`, `CLAUDE.md` e `agente`. Entre o início do projeto e o item 2, o prompt #63 é
a **única** correção do PO ao comportamento do agente. Não é a hipótese mais provável
— é a única.
