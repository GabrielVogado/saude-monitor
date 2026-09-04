# Rulesets de proteção de branch

Estes JSON são importáveis em **Settings → Rules → Rulesets → New ruleset →
Import a ruleset**.

## ⚠️ Estes arquivos não fazem nada sozinhos

**O GitHub não lê esta pasta.** Não existe convenção `.github/rulesets/` — diferente de
`.github/workflows/`, que é lida de verdade. O JSON aqui é **backup e documentação**; a
regra só passa a existir quando alguém a importa nas *Settings* do repositório.

Consequências que valem dizer em voz alta:

- **Quem clona ou faz fork não é afetado.** Rulesets são configuração de servidor,
  deste repositório. Não viajam num `git clone` nem num fork. No fork de outra pessoa,
  ela cria branch, reescreve histórico e faz `push --force` à vontade.
- **Antes das regras, existe a permissão.** Só quem tem acesso de escrita consegue
  empurrar para cá — hoje, apenas o dono. As regras só têm a quem se aplicar quando
  alguém *tem* permissão.
- **A única peça deste conjunto que viaja com o código** é o
  `.github/workflows/pr-origem-master.yml`. Num fork ele até roda, mas só reprova um
  check lá; não impede nada.

O que muda de fato, depois de importar: `git push origin develop` (e `master`) passa a
ser recusado, e toda mudança entra por PR. Como só o dono tem acesso, o efeito real é
protegê-lo do próprio descuido — um `push --force` na branch errada às onze da noite.

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
| **Aprovação exigida** | 0 | 0 | Ver "Quem pode mergear" abaixo — a exclusividade já vem da permissão do repositório, não de uma regra |
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

## Quem pode mergear na `master`

**Só o dono do repositório — e isso não depende de nenhuma regra.**

Verificado em 03/09/2026:

```
colaboradores: GabrielVogado — permissao: admin
repositorio pessoal (fora de organizacao)
```

Há **um único colaborador**, e o repositório é pessoal. Ninguém mais tem acesso de
escrita, então ninguém mais consegue mergear coisa alguma — em `master` ou em
qualquer outro lugar. A exigência "só eu aceito PR para a master" já está satisfeita
pela permissão, e nenhum ruleset a torna mais verdadeira.

### Por que NÃO exigimos aprovação

A primeira versão deste ruleset exigia 1 aprovação na `master`. Foi revertido, e vale
registrar o porquê:

**O GitHub não permite que o autor aprove o próprio PR.** Com um desenvolvedor só,
todo PR sai da conta do dono — logo, não existe quem aprove. O resultado prático não
seria proteção: seria a `master` **impossível de mergear** sem acionar o bypass a cada
promoção. Uma regra que só se cumpre desligando a regra não é uma regra; é atrito com
aparência de rigor.

O que efetivamente protege a `master` são os três checks obrigatórios e a restrição de
origem — coisas que uma máquina verifica e que ninguém contorna por distração.

### O que muda se um colaborador for adicionado

Aí a exclusividade deixa de ser automática, e passa a valer a pena:

1. Subir `required_approving_review_count` para 1 — com um segundo revisor, a
   aprovação passa a significar algo.
2. Adicionar o dono a `bypass_actors` e manter os demais sob a regra, para que só ele
   possa promover em caráter excepcional.

Enquanto o repositório tiver um colaborador só, as duas mudanças seriam teatro.

## ⚠️ Dois passos que o import não faz por você

1. **`bypass_actors` está vazio de propósito.** Não chutei o `actor_id` do papel de
   administrador — errar aí ou trava você fora do merge, ou abre uma porta que
   ninguém pediu. Depois de importar: **Edit ruleset → Bypass list → Add bypass →
   Repository admin**.

   Na `develop` isso é opcional: protege contra o próprio descuido, mas não deixa
   saída se o CI quebrar por causa externa (aconteceu em 03/09, no `npm ci` do PR
   #61).

   Na `master` vale o mesmo raciocínio. Com a aprovação de volta a 0, ela **não** é
   obrigatória — o bypass ali serve só para emergência, como promover com um check
   externo fora do ar.

2. **Os nomes dos checks precisam bater exatamente** com os nomes dos jobs do
   `ci.yml`: `Backend (Spring Boot)` e `Frontend (Expo Web)`. Se um job for renomeado,
   o ruleset passa a exigir um check que nunca chega — e o PR fica travado para
   sempre, esperando algo que não existe. Renomear job implica atualizar estes dois
   arquivos e reimportar.
