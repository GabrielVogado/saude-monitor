# UPD-002 — Matriz de roteamento de skills por área + gatilho automático

- **Origem:** [OBS-002](../skill-observations/OBS-002-ativacao-de-skills-por-dominio.md)
- **Data:** 03/09/2026
- **Estado:** ✅ Aplicada

## Problema a resolver

O `CLAUDE.md` mandava ativar "o agente/skill **mais adequado**" (singular) e não
dizia qual skill serve para qual parte do sistema. Resultado: ativação única ou
nenhuma, em um repositório onde a tarefa típica cruza `backend/` e `frontend/`.

## O que muda

### 1. Nova fonte única: `.claude/skills-roteamento.md`

Matriz **área tocada → skills**, cobrindo `backend/`, `frontend/`, `deploy/` e
CI, `Documentos/`, `.claude/`, visualização de dados e integração com LLM. Mais
dois portões independentes de área: `code-review` antes de todo PR, e
`security-review` quando o diff toca autenticação, tokens, dados pessoais ou
endpoint público.

Inclui também uma seção **"skills que NÃO se aplicam"**, para impedir ativação por
semelhança superficial:

- `quarkus` — o backend é **Spring Boot 4**, não Quarkus.
- `awesome-llm-apps-fullstack-developer` — o produto não tem camada de LLM.

### 2. `CLAUDE.md` §2 e §3 reescritos

Passam a apontar para a matriz e a exigir **uma skill por área tocada**, com o
anúncio das skills ativadas antes da primeira edição. A redação anterior
("o mais adequado", singular) sai.

### 3. Gatilho automático: hook `SessionStart`

Instrução em documento não se aplica sozinha — foi exatamente o que falhou. O hook
`.claude/hooks/roteamento-skills.js`, declarado em `.claude/settings.json`, lê a
matriz e a injeta como `additionalContext` no início de cada sessão. O harness
passa a entregar a regra, em vez de o agente ter de ir buscá-la.

Decisões de implementação:

- **Node em vez de `jq`** — `jq` não está instalado nas máquinas do projeto
  (verificado: ausente do `PATH`); `node` está, porque o frontend depende dele.
- **Falha em silêncio** (`process.exit(0)`) se a matriz sumir: quebrar o início da
  sessão seria pior do que não injetar o contexto.
- **`suppressOutput: true`** — o conteúdo vai para o modelo, não para o transcript
  do usuário.

## Verificação executada

- *Pipe-test* do comando com `echo '{}' |` antes de escrever o `settings.json`:
  JSON válido, saída correta, exit 0.
- Validação do `settings.json`: o comando é alcançável no caminho
  `hooks.SessionStart[].hooks[].command`.

> ⚠️ **Um passo depende do PO:** o watcher de configuração só observa diretórios
> que já tinham arquivo de settings no início da sessão. Como `.claude/settings.json`
> foi criado agora, o hook passa a valer a partir da **próxima sessão** (ou depois
> de abrir `/hooks` uma vez).

## Custo e risco

- **Custo:** ~40 linhas injetadas por sessão, uma vez.
- **Risco:** baixo — o hook só lê arquivo e escreve em stdout; não bloqueia nada.
- **Reversão:** apagar o bloco `hooks` de `.claude/settings.json`.
