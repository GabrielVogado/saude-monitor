# OBS-004 — Skill ativada que não cobre nada da tarefa

- **Data:** 06/09/2026
- **Observador:** registrado pelo agente durante o BUG-08 (a matriz manda registrar a lacuna em vez de improvisar)
- **Estado:** 🔵 Aberta — depende de decisão do PO

## O que aconteceu

A matriz de roteamento foi seguida à risca no BUG-08: o diff toca `backend/` e
`frontend/`, então `java` e `expo-skills` foram ativadas, em paralelo, antes da
primeira edição. As duas carregaram e nenhuma das duas disse **uma linha** sobre o
que a tarefa exigia.

O que o BUG-08 precisava saber:

| Assunto | Onde a resposta foi buscada |
|---|---|
| `expo-location` — geofencing nativo, `startGeofencingAsync`, raio das regiões | código do próprio projeto |
| Ler posição dentro de uma `TaskManager` em background | código do próprio projeto |
| `ApplicationRunner` + `@Order` + `@ConditionalOnProperty` | código do próprio projeto |
| Migrar dado já gravado no MongoDB via runner idempotente | nenhuma referência — decidido do zero |
| Testar geofencing com timers falsos no Jest | nenhuma referência — decidido do zero |

O que as skills traziam: `expo-skills` cobre criação de projeto, `eas build`,
`eas submit`, upgrade de SDK, Expo Router, `SecureStore`, push notifications e
image picker — nada sobre `expo-location`, geofencing ou background tasks, que são
o **núcleo do produto** (F-03/ADR-002). A `java` é um cartão de referência de
records, sealed classes, streams e `Optional`, sem nada de Spring Boot além da
frase "Spring ecosystem" na descrição.

## Por que isso importa

O custo não é o token gasto — é o falso conforto. A matriz dá por resolvido o passo
"ativei a skill da área", e o relatório de sessão registra duas skills ativadas,
como se a tarefa tivesse tido apoio especializado. Não teve. **Skill ativada não é
skill que cobre**, do mesmo jeito que, no [OBS-003](./OBS-003-skill-anunciada-nao-e-skill-ativada.md),
skill anunciada não era skill ativada.

Vale dizer o que isto **não** é: nenhuma das duas skills atrapalhou, nenhuma
induziu a erro, e a `expo-skills` continua correta para o que ela cobre. A lacuna é
de escopo, não de qualidade.

## Medida

Este é o segundo caso do mesmo tipo. No [OBS-003](./OBS-003-skill-anunciada-nao-e-skill-ativada.md)
a `lobehub-react` saiu da matriz porque o conteúdo dela não existia no
`package.json`. Aqui a `expo-skills` **acerta** a stack e ainda assim não cobre o
subsistema mais crítico dela.

## Decisão do PO (pendente)

1. Escrever uma skill de projeto para o geofencing (`expo-location`, `TaskManager`,
   tolerâncias RN-01/RN-03, o contrato do check-in) — o assunto já produziu dois
   bugs de severidade alta (BUG-04 e BUG-08) e não tem nenhuma referência escrita.
2. Ou registrar na matriz, por escrito, que `expo-skills` cobre build/deploy/SDK e
   **não** cobre os módulos nativos — para que a ativação dela não seja lida como
   cobertura do assunto.
3. Ou nada, aceitando que a matriz roteia por área e não promete profundidade.
