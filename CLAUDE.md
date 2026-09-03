# CLAUDE.md — Configuração de Inicialização

## Instruções de Inicialização Obrigatórias

### 1. Leitura da pasta `Documentos/`

**ANTES DE QUALQUER AÇÃO**, ler os arquivos da pasta `Documentos/` para entender o
contexto do projeto. Começar pelo índice, que aponta para o resto e registra a
última revisão documental:

- `Documentos/00-INDICE.md`
- `Documentos/De-Para-Backlog-Features.md` — placar de estórias entregues
- `Documentos/05-features/Relatorio-Aderencia-Codigo-vs-Features.md`
- `Documentos/04-backlog/Backlog-MVP-v2.1.md`
- `Documentos/git-flow/MANUAL.md` — fluxo de branches, ambientes e CI/CD
- Demais arquivos conforme a área da tarefa

### 2. Ativação de skills — **uma por área tocada**

A regra completa vive em **[`.claude/skills-roteamento.md`](.claude/skills-roteamento.md)**,
que é a fonte única e é injetada automaticamente no início de cada sessão pelo hook
`SessionStart` de `.claude/settings.json`.

Em resumo:

- Ativar **uma skill por área tocada pela tarefa — não uma por tarefa.** Se o diff
  cruza `backend/` e `frontend/`, ativar as duas, em paralelo.
- A área é definida pelos **arquivos que serão tocados**, não pelo assunto da frase.
- **Anunciar** quais skills foram ativadas e por quê, antes da primeira edição.
- Nenhuma skill cobre a área? Registrar a lacuna em `skill-observations/` em vez de
  improvisar.

Diretórios de skills: `C:\Users\Gabriel\.claude\skills` (globais) e
`D:\saude-monitor\.claude\skills` (do projeto).

> **Por que a regra é essa:** ver [OBS-002](skill-observations/OBS-002-ativacao-de-skills-por-dominio.md).
> A redação anterior — "delegar para o agente/skill **mais adequado**", no singular —
> induzia ativação única em um repositório onde a tarefa típica cruza áreas.

### 3. Delegação e execução

Depois das etapas 1 e 2:

- Mapear os arquivos que a tarefa vai tocar → colunas da matriz de roteamento.
- Delegar a cada skill ativada o que cabe à área dela; coordenar quando forem várias.
- Manter o contexto entre delegações.
- Consolidar os resultados e apresentar ao usuário.

## Fluxo de Trabalho

```
1. Ler Documentos/ → 2. Ativar skills (por área) → 3. Delegar → 4. Consolidar → 5. Entregar
```

## Regras

- NUNCA pular a leitura da pasta `Documentos/`.
- NUNCA pular a ativação das skills.
- SEMPRE ativar **todas** as skills das áreas tocadas, não apenas uma.
- SEMPRE rodar `code-review` sobre o diff antes de abrir um PR.
- Fazer perguntas relevantes para não sair do contexto e não fugir do objetivo.

## Entrega

- **Um PR por tarefa concluída**, para `develop`, seguindo `Documentos/git-flow/MANUAL.md`.
- **Regra D-03:** o PR que entrega uma estória atualiza o status dela no `De-Para`,
  no mesmo PR. Sem isso, o PR não fecha a estória.
- Toda melhoria de processo aplicada entra em
  [`Documentos/09-melhoria-continua/Historico-Melhorias.md`](Documentos/09-melhoria-continua/Historico-Melhorias.md).

## Melhoria contínua

| Pasta | Conteúdo |
|---|---|
| [`skill-observations/`](skill-observations/) | O que o PO corrigiu no comportamento do agente |
| [`skill-updates/`](skill-updates/) | A proposta de alteração derivada — o PO decide o que vira regra |
| [`Documentos/09-melhoria-continua/`](Documentos/09-melhoria-continua/) | Histórico do que efetivamente entrou, e em qual PR |
