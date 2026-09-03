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
| **M-001** | — | *(não registrada)* | Item 1 do Observer — anterior a esta sessão; as pastas `skill-observations/` e `skill-updates/` não existiam ainda, então nada foi persistido. **Pendente de reconstituição pelo PO.** | — | 🔴 Pendente |
| **M-002** | 03/09/2026 | [OBS-002](../../skill-observations/OBS-002-ativacao-de-skills-por-dominio.md) → [UPD-002](../../skill-updates/UPD-002-matriz-de-roteamento-de-skills.md) | Matriz de roteamento de skills por área + hook `SessionStart` que a injeta em toda sessão | #63 | ✅ Aplicada |

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
