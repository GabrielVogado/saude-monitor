# Rulesets de proteção de branch

Estes JSON são importáveis em **Settings → Rules → Rulesets → New ruleset →
Import a ruleset**.

## Por que ficam versionados

Em 03/09/2026 descobrimos que **nem `develop` nem `master` estavam protegidas**, embora
o `De-Para` registrasse desde 02/09 que a `develop` exigia os dois checks de CI.

A causa mais provável: o repositório foi tornado **privado** por alguns minutos naquele
dia. Proteção de branch não está disponível em repositório privado no plano Free, e
**voltar a público não a restaura**. A proteção sumiu em silêncio, e a documentação
seguiu afirmando que existia.

Versionar o JSON transforma um clique perdido em um arquivo auditável: se acontecer de
novo, é reimportar.

## O que cada um faz

| Regra | `develop` | `master` | Por quê |
|---|---|---|---|
| `deletion` | ✅ | ✅ | Ninguém apaga a branch por acidente |
| `non_fast_forward` | ✅ | ✅ | Sem `push --force` reescrevendo história compartilhada |
| `pull_request` | ✅ | ✅ | Toda mudança entra por PR. **Zero aprovações exigidas** — o projeto tem um desenvolvedor só, e exigir revisão travaria o fluxo |
| `required_status_checks` | ✅ | ✅ | `Backend (Spring Boot)` e `Frontend (Expo Web)` precisam passar |
| `strict_required_status_checks_policy` | ❌ | ✅ | Em `master`, o PR precisa estar **atualizado com a base** antes do merge. Em `develop` seria atrito diário sem ganho |
| `allowed_merge_methods` | merge, squash, rebase | **só merge** | Em produção, o histórico precisa preservar o commit de merge para rastrear o que foi promovido |
| `do_not_enforce_on_create` | ✅ | ✅ | A criação da branch não é bloqueada por falta de checks |
| **Aprovação exigida** | 0 | **1** | Decisão do PO em 03/09/2026: promoção para produção passa pela aprovação dele. **Leia a ressalva abaixo — em repositório de um dono só, isso se auto-bloqueia sem bypass** |
| **Check `Origem do PR (master)`** | — | ✅ | A `master` só aceita PR vindo da `develop` |

## A `master` só aceita PR da `develop`

Não existe regra nativa para isso — nem em ruleset nem em branch protection. O GitHub
sabe restringir **quem** faz o merge e **quais checks** precisam passar, mas não **de
onde** o PR vem.

Por isso a restrição virou um check: `.github/workflows/pr-origem-master.yml` roda em
todo PR que aponta para `master` e falha se a origem não for `develop`. O ruleset da
`master` exige esse check.

**Por que a regra existe:** `master` é produção. Um PR de feature direto para lá
pularia a integração em `develop` — ninguém teria visto aquele código conviver com o
resto antes de ele ir ao ar.

## ⚠️ A aprovação exigida na `master` se auto-bloqueia sem bypass

**O GitHub não permite que o autor aprove o próprio PR.** Como o projeto tem um
desenvolvedor só, e todo PR sai da conta dele, exigir 1 aprovação significa que
**nenhum PR pode ser mergeado** — não há quem aprove.

Com o bypass de administrador configurado, o efeito real é outro e mais útil: o botão
de merge deixa de ficar verde sozinho, e a promoção passa a exigir um
*"merge without waiting for requirements"* consciente. Vira **passo deliberado**, e
fica registrado como tal no histórico do PR.

É um redutor de velocidade honesto, não um portão que outra pessoa guarda. Se um dia
houver um segundo revisor, a regra passa a valer no sentido pleno sem nenhuma
alteração.

> **Consequência prática:** sem adicionar o bypass, a `master` fica **impossível de
> mergear**. O passo 1 abaixo deixa de ser opcional para ela.

## ⚠️ Dois passos que o import não faz por você

1. **`bypass_actors` está vazio de propósito.** Não chutei o `actor_id` do papel de
   administrador — errar aí ou trava você fora do merge, ou abre uma porta que
   ninguém pediu. Depois de importar: **Edit ruleset → Bypass list → Add bypass →
   Repository admin**.

   Na `develop` isso é opcional: protege contra o próprio descuido, mas não deixa
   saída se o CI quebrar por causa externa (aconteceu em 03/09, no `npm ci` do PR
   #61).

   Na **`master` é obrigatório**, pela ressalva da aprovação acima — sem bypass ela
   fica impossível de mergear.

2. **Os nomes dos checks precisam bater exatamente** com os nomes dos jobs do
   `ci.yml`: `Backend (Spring Boot)` e `Frontend (Expo Web)`. Se um job for renomeado,
   o ruleset passa a exigir um check que nunca chega — e o PR fica travado para
   sempre, esperando algo que não existe. Renomear job implica atualizar estes dois
   arquivos e reimportar.
