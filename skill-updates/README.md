# skill-updates/

Propostas de alteração derivadas de [`skill-observations/`](../skill-observations/).
Cada arquivo descreve **o que muda, onde, e por quê** — para o Product Owner
revisar antes de virar regra.

Convenção de nome: `UPD-<nnn>-<assunto>.md`, com `<nnn>` igual ao da observação
que a originou.

## Índice

| ID | Origem | O que altera | Estado |
|---|---|---|---|
| *(sem UPD-001)* | [OBS-001](../skill-observations/OBS-001-skill-pela-linguagem-do-arquivo.md) | Nada — a regra do item 1 foi absorvida pela matriz do UPD-002 (linha `backend/` → `java`) | ➖ Não houve proposta própria |
| [UPD-002](./UPD-002-matriz-de-roteamento-de-skills.md) | OBS-002 | `CLAUDE.md`, `.claude/skills-roteamento.md`, hook `SessionStart` | ✅ Aplicada (PR #63) |
| [UPD-003](./UPD-003-portao-verificavel-e-escopo-de-skills.md) | OBS-003 | Escopo de skills (`lobehub-react` sai) · redação "ativar" · hook que cobra o portão | 🟡 Item 1 aplicado; 2 e 3 dependem do PO |
