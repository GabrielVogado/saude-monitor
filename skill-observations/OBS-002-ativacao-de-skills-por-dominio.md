# OBS-002 — Skills não são ativadas conforme a necessidade e a área de atuação

- **Data:** 03/09/2026
- **Observador:** Gabriel Vogado (Product Owner)
- **Estado:** ✅ Aplicada — ver [UPD-002](../skill-updates/UPD-002-matriz-de-roteamento-de-skills.md)

## O que o PO observou

> "as skills não estão sendo ativadas conforme necessidade e área de atuação por
> demanda, ative mais de uma skill se necessário"

## O comportamento observado

O `CLAUDE.md` já mandava ativar as skills (§2) e delegar para "o agente/skill mais
adequado" (§3). Duas falhas na prática:

1. **Ativação por tarefa, não por área.** A instrução diz *"o mais adequado"*, no
   singular. Uma tarefa que toca `backend/` e `frontend/` ao mesmo tempo — o que é
   a norma neste repositório, ver o próprio OPS-05 (PR #62), que mexeu em 22
   arquivos dos dois lados — recebia no máximo uma skill.
2. **Instrução sem gatilho.** A regra vivia só no `CLAUDE.md`, um documento que o
   agente lê mas não é obrigado a aplicar em nenhum ponto específico do fluxo.
   Nada verificava se a ativação aconteceu.

## Causa

O `CLAUDE.md` descrevia **o quê** (ativar skills) sem descrever **qual, quando e
quantas**. Não havia mapa de área → skill, e a única formulação existente
("o mais adequado", singular) induzia ativação única. Sem um ponto do fluxo em que
a regra é cobrada, a instrução dependia de o agente lembrar dela.

## Regra que sai disso

**Ativar uma skill por área tocada pela tarefa — não uma por tarefa.** A área é
determinada pelos arquivos que serão tocados, não pelo assunto da frase do
usuário. Quando o diff cruza áreas, todas as skills correspondentes são ativadas,
em paralelo, e anunciadas antes da primeira edição.

## Evidência da aplicação nesta mesma sessão

Três skills ativadas por área, e o que cada uma cobriu:

| Skill | Área | Uso concreto |
|---|---|---|
| `software-architect` | Decisão estrutural | Desenho da matriz de roteamento |
| `expo-skills` | `frontend/` | Revisão das mudanças de rede/offline (OPS-05) e do lint (E8-13) antes dos PRs |
| `update-config` | `.claude/` | Hook `SessionStart` que injeta a matriz — inclusive o passo de *pipe-test* antes de escrever o `settings.json` |
