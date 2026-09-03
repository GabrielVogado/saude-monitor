# skill-observations/

Registro das correções que o Product Owner faz no comportamento do agente durante
o trabalho. Cada arquivo é **uma observação**: o que o agente fez, o que o PO
corrigiu, e a regra que sai disso.

Faz par com [`skill-updates/`](../skill-updates/), que guarda a **proposta de
alteração** derivada da observação, e com
[`Documentos/09-melhoria-continua/Historico-Melhorias.md`](../Documentos/09-melhoria-continua/Historico-Melhorias.md),
que registra o que **efetivamente entrou** e em qual PR.

Baseado no padrão *One Skill to Rule Them All*
(https://github.com/rebelytics/one-skill-to-rule-them-all, CC BY 4.0).

## Ciclo

```
observação (aqui) → proposta (skill-updates/) → PO revisa → aplicada → histórico
```

O agente **propõe**; quem decide o que vira regra é o PO.

## Convenção de nome

`OBS-<nnn>-<assunto-em-kebab-case>.md` — a numeração é a do PO ("item 1", "item 2").

## Índice

| ID | Assunto | Estado |
|---|---|---|
| [OBS-001](./OBS-001-skill-pela-linguagem-do-arquivo.md) | Skill escolhida pela proximidade da instalação, não pela linguagem do arquivo | ✅ Aplicada (via UPD-002) — registro reconstituído em 03/09/2026 |
| [OBS-002](./OBS-002-ativacao-de-skills-por-dominio.md) | Skills não são ativadas conforme a área de atuação | ✅ Aplicada (UPD-002) |
