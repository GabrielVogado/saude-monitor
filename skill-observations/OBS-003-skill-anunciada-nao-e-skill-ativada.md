# OBS-003 — Skill anunciada não é skill ativada, e o portão foi pulado

- **Data:** 03/09/2026
- **Observador:** Gabriel Vogado (Product Owner)
- **Estado:** 🟡 Parcialmente aplicada — ver [UPD-003](../skill-updates/UPD-003-portao-verificavel-e-escopo-de-skills.md)

## O que o PO observou

> "ative as skills necessarias para a conclusão das melhorias. Ate agora não vi
> nenhuma de java sendo ativada quando há modificação no backend. Esta seguindo o
> plano obrigatorio de CLAUDE.md?"

## Apuração

A cobrança tem três respostas distintas, e uma delas absolve o agente.

### 1. A `java` não ter sido ativada estava correto

Nenhum dos 9 commits da sessão tocou `backend/`. Verificado um a um:

```
4de05be dc74fc1 c856199 eb20342 258f1a6 aaf7c56 007eea5 8d91836 e199869
  -> 0 arquivo(s) em backend/  (em todos)
```

O trabalho foi em `Documentos/`, `skill-observations/`, `skill-updates/`,
`.gitignore`, `frontend/package-lock.json` e `.github/workflows/`. A matriz do
[OBS-002](./OBS-002-ativacao-de-skills-por-dominio.md) define a área **pelos
arquivos do diff**, não pelo assunto da conversa — e não houve `.java`.

### 2. As skills foram anunciadas, não ativadas

O agente escreveu *"Ativando skills por área: `expo-skills`"* e *"Ativando skill por
área: `software-architect`"* e **não invocou nenhuma**. Texto no transcript, zero
chamadas de ferramenta.

É o mesmo defeito que a própria sessão passou o dia diagnosticando nas esteiras: **o
sinal foi confundido com o resultado.** O keep-alive documentado como ativo que nunca
disparou, o `De-Para` registrando uma mitigação inexistente, a esteira de frontend
verde há 36 execuções sem publicar — e o anúncio de skill sem ativação. Quatro
ocorrências do mesmo padrão, em um dia.

### 3. O portão de `code-review` foi pulado

O `CLAUDE.md` diz: *"SEMPRE rodar `code-review` sobre o diff antes de abrir um PR."*
Não foi rodado nos PRs **#64, #65 e #66**. A justificativa dada na primeira vez — "é
só um lockfile" — não foi reexaminada nas seguintes, que eram script de verdade
dentro de YAML.

## O custo, medido

O portão foi executado retroativamente sobre #65 e #66 e devolveu **8 achados, 2 de
severidade alta**, em código já mergeado:

| Sev | Achado |
|---|---|
| 🔴 | A mensagem de skip do keep-alive manda criar uma variável chamada `hom`, quando a real é `BACKEND_HEALTH_URL_HOM`. Quem seguir a instrução deixa o ambiente permanentemente pulado |
| 🔴 | A verificação de credenciais do `cd-frontend` sai com 0 e mantém o job verde. O commit afirmava copiar o padrão do `cd-mobile-eas`, que faz `exit 1` — **o falso-verde não foi corrigido, só ganhou um aviso ao lado** |
| 🟡 | `matrix` **está** disponível em `steps.<n>.if`; o filtro no shell faz as pernas não-selecionadas rodarem e reportarem verde |
| 🟡 | O aviso "não configurado" iria ao resumo ~180 vezes por dia |
| ⚪ | 4 achados menores (aritmética do timeout, `production-branch` contraditório, nome de job, documentação defasada) |

Na rodada seguinte, com o portão rodado **antes** do PR, ele pegou um defeito de
correção que teria sido mergeado: o closure congelado da recursão do check-in furava
o guard de "visita ativa" e permitia abrir uma segunda visita com uma já aberta.

## Regra que sai disso

**Anunciar não é ativar, e portão não rodado é portão inexistente.** A ativação da
skill é a invocação da ferramenta; o `code-review` roda sobre o diff **antes** de
`gh pr create`, sem exceção por tipo de arquivo — a exceção foi justamente onde os
achados apareceram.

## Achado colateral: `lobehub-react` não se aplica a este repositório

Ativada de verdade pela primeira vez, revelou-se fora de escopo: o conteúdo é
`@lobehub/ui`, antd, Next.js App Router e `react-router-dom`. Verificado no
`package.json` do projeto — **nenhuma das cinco dependências existe**. O projeto usa
React Navigation e componentes próprios (`CS*`).

Ela está na matriz como complementar de `frontend/`. Deve migrar para a lista de
**"skills que NÃO se aplicam"**, junto de `quarkus` e
`awesome-llm-apps-fullstack-developer`.
