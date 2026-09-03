# Matriz de Roteamento de Skills — saude-monitor

> Fonte única da regra de ativação de skills. Injetada em toda sessão pelo hook
> `SessionStart` declarado em `.claude/settings.json`. Editar **aqui**, não em cópias.

## Regra

**Ativar uma skill por área tocada pela tarefa — não uma por tarefa.** Se o trabalho
cruza `backend/` e `frontend/`, as duas colunas se aplicam e as duas skills são
ativadas, em paralelo. A área é determinada pelos arquivos que a tarefa vai tocar,
não pelo assunto da frase do usuário.

## Matriz

| Área tocada | Skills obrigatórias | Complementares (ativar quando o gatilho ocorrer) |
|---|---|---|
| `backend/` — Spring Boot 4, Java 25, MongoDB | `java` | `software-architect` (mudança estrutural ou novo ADR) · `security-review` (autenticação, JWT, LGPD, endpoint público) |
| `frontend/` — Expo 55, React Native, `react-native-web` | `expo-skills` | `lobehub-react` (componente, hook ou estado React) · `run` (confirmar a mudança na tela real) |
| `deploy/`, `.github/workflows/`, `render.yaml` | `software-architect` | `update-config` |
| `Documentos/` | — (nenhuma obrigatória) | `software-architect` (decisão arquitetural, ADR, De-Para) |
| `.claude/`, `CLAUDE.md`, hooks, permissões | `update-config` | `fewer-permission-prompts` · `claude-code-setup:claude-automation-recommender` |
| Gráfico, painel ou relatório visual | `dataviz` | — |
| Integração com LLM / API Claude | `claude-api` | — |

## Portões (independentes da área)

- **Antes de abrir qualquer PR:** `code-review` sobre o diff.
- **Se o diff toca autenticação, tokens, dados pessoais ou endpoint público:** `security-review`.

## Skills que NÃO se aplicam a este repositório

- **`quarkus`** — o backend é **Spring Boot 4**, não Quarkus. Não ativar por semelhança de "backend Java".
- **`awesome-llm-apps-fullstack-developer`** — o produto não tem camada de LLM.

## Protocolo de sessão

1. Ler `Documentos/` (regra do `CLAUDE.md`).
2. Mapear os arquivos que a tarefa vai tocar → colunas da matriz.
3. **Anunciar** quais skills foram ativadas e por quê, antes da primeira edição.
4. Nenhuma skill cobre a área? Registrar a lacuna em `skill-observations/` em vez de improvisar.
