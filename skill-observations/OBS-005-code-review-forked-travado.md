# OBS-005 — `code-review` em execução forked travava em loop de deliberação

- **Data:** 10/09/2026
- **Observador:** registrado pelo agente durante a PR de confirmação de e-mail no cadastro (portão obrigatório de `code-review` antes de abrir a PR)
- **Estado:** 🔵 Aberta — registrada por diretriz anti-efeito-cobra; depende de decisão do PO

## O que aconteceu

Um PR que toca auth tem dois portões obrigatórios pela matriz de roteamento:
`code-review` sobre o diff e `security-review` (autenticação/tokens/dados
pessoais). Nesta tarefa:

1. O `security-review` rodou e entregou 1 achado de média severidade real
   (oráculo de tempo na confirmação de e-mail), que foi corrigido.
2. O `code-review` foi invocado pela skill (`/code-review medium`), que executa em
   **fork** — e o fork **travou em loop de deliberação**: 47 s, **0 chamadas de
   ferramenta**, devolvendo apenas texto repetitivo ("Let me run the git fetch and
   diff commands", "Execute the tool call now", etc., dezenas de vezes) sem nunca
   executar o `git diff` que ele mesmo planejava. O resultado entregue não continha
   um único achado de revisão.

## Por que isso importa

O custo não é o token gasto (4 k) nem os 47 s — é o **portão inexistente com a
fachada de portão**. Se uma PR fosse fechada sem cruzar o resultado real do
`code-review` (contando com a skill para revisar), o achado do `security-review`
deste mesmo diff seria o único filtro — e há classes de bug de revisão (corridas,
performance, simplicidade) que o filtro de segurança não pega. Foi exatamente o
achado do PR #105: a paginação do Ranking tinha a mesma falha da aba Hospitais e só
o `code-review` do próprio PR a encontrou.

Vale dizer o que isto **não** é: não foi um erro do conteúdo da skill (a definição
do `/code-review` está correta), e não foi interferência externa. Foi a **execução
em fork que degradou** — deliberação sem ação — num caso em que a skill depende de
rodar o diff do repositório no working tree.

## Medida

O portão foi cumprido manualmente (revisão completa do diff feita a partir da
leitura dos arquivos, com o achado real documentado no M-013). Não se relançou a
skill às cegas no mesmo modo forked esperando sorte — isso seria "preencher
protocolo", exatamente o que a diretriz anti-efeito-cobra proíbe.

## Decisão do PO (pendente)

1. Relançar `code-review` em execução **síncrona** (não forked) quando o alvo for o
   próprio working tree em mudança — o fork pode deliberar sem agir; o modo direto
   ao menos executa as ferramentas.
2. Ou registrar por escrito que, se a invocação da skill voltar **sem nenhuma
   chamada de ferramenta e sem achados**, ela NÃO conta como portão cumprido — o
   agente deve revisar manualmente e anotar o travamento nesta pasta, em vez de
   registrar "code-review rodado" no relatório.
3. Ou nada, aceitando que portão robótico é o preço de automação e que o humano
   revisa a PR de qualquer forma.