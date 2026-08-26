# Plano de Implementação — Épico 2: Detecção de Visitas (Geofence)

> Gerado a partir de: `Backlog-MVP-v2.0.md` (Épico 2, RN-01..RN-07/RN-23/RN-24, Sprints S2/S3),
> `Features-MVP-v2.0.md` (F-03, F-04), `Plano-Sprints-v2.0.md` (S2/S3) e
> `Especificacao-API-v2.0.md` (§2.3, §3.3). Status de código-fonte confirmado: 🔴 Inexistente
> (nenhum módulo `visita` no backend; nenhum geofencing nativo no frontend).
>
> Ordem: dependências internas → externas (Tipos/Modelos → Documents/DB → Services →
> Controllers/REST → UI/Mobile), respeitando a ordem de sprint do backlog (S2 antes de S3) e a
> dependência explícita **E2-09 (heartbeat) antes de E2-03 (expiração)**.
> Frentes: `[BACKEND]` (executar com skill `fullstack-developer`) e `[MOBILE]` (executar com
> skill `react`).
>
> **Nota de verificação (26/08/2026):** checkboxes abaixo revisados por leitura direta do
> código-fonte do commit `da9ecf9` (não apenas do diff). Gaps identificados nos Steps 7, 16, 17
> e 19 — esses Steps permanecem `[ ]` mesmo havendo código parcial relacionado, pois não atendem
> integralmente ao critério original do plano.

---

## Fase 0 — Pré-requisitos e dependências

- [x] [BACKEND] Step 1: Confirmar `@EnableScheduling` disponível.
- [x] [MOBILE] Step 2: Adicionar dependências ao `frontend/package.json`: `expo-task-manager`,
  `expo-notifications`.
- [x] [MOBILE] Step 3: Atualizar `frontend/app.json`: permissão `ACCESS_BACKGROUND_LOCATION`,
  plugin `expo-location` com `locationAlwaysAndWhenInUsePermission`/`isAndroidBackgroundLocationEnabled`,
  `NSLocationAlwaysAndWhenInUseUsageDescription`, plugin `expo-notifications`.

## Fase 1 — Tipos e modelos de domínio (Backend)

- [x] [BACKEND] Step 4: Módulo `br.com.saude_monitor.api.visita` criado.
- [x] [BACKEND] Step 5: Enums `StatusVisita`, `OrigemVisita`, `TipoPermanencia`.
- [x] [BACKEND] Step 6: DTOs de request/response criados.

## Fase 2 — Modelo de banco / Documents (Backend)

- [x] [BACKEND] Step 7: `VisitaDocument` — campo `encerramentoManual` adicionado
  (`VisitaDocument`/`CheckoutRequest`), exigido por F-04 CA#3.
- [x] [BACKEND] Step 8: Índices Mongo conforme spec.
- [x] [BACKEND] Step 9: `VisitaRepository` com métodos derivados (nomes divergem do plano
  original mas cobrem os mesmos casos de uso).

## Fase 3 — Services / Integrações (Backend) — ordem de sprint S2 → S3

- [x] [BACKEND] Step 10 `[E2-01]`: `checkin` — controller responde `201` (visita nova) ou
  `200` (retorno idempotente) via flag `criado` no `CheckinResponse`.
- [x] [BACKEND] Step 11 `[E2-02]`: `checkout`.
- [x] [BACKEND] Step 12 `[E2-06]`: `checkin` origem `MANUAL`.
- [x] [BACKEND] Step 13 `[E2-07]`: `buscarAtiva`/histórico paginado.
- [x] [BACKEND] Step 14 `[E2-09]`: `heartbeat` + marcação `SUSPEITA` (unificado em
  `VisitaExpiracaoJob`, sem classe `VisitaSuspeitaJob` dedicada — funcionalmente correto).
- [x] [BACKEND] Step 15 `[E2-03]`: `VisitaExpiracaoJob` (marca `EXPIRADA`).
- [x] [BACKEND] Step 16 `[E2-04]`: desempate automático por distância + detecção de empate
  (≤10m) lançando `ConflitoGeofenceException` → HTTP `409` com `candidatos` (handler dedicado).
- [x] [BACKEND] Step 17 `[E2-05]`: `pontosAmostrais`/`ultimaPosicaoEm` gravados em
  `checkin`/`checkout`/`heartbeat` (posição opcional); `VisitaGpsInterrompidoJob` encerra
  visitas ativas sem sinal de posição por 10min como `GPS_INTERROMPIDO`.
- [x] [BACKEND] Step 18 `[E2-10]`: `definirTipoPermanencia` com validação de 12h.
- [x] [BACKEND] Step 19 `[E2-08]`: flag `visitaValida` (`true` quando `duracaoMinutos == null`
  ou `>= 2`) no `VisitaResponse`; exclusão da agregação pública fica para o job do Épico 04
  (F-06), conforme plano.

## Fase 4 — Controllers / Endpoints REST (Backend)

- [x] [BACKEND] Step 20: `VisitaController` com todos os endpoints.
- [x] [BACKEND] Step 21: `AutenticacaoHelper` + `dispositivoId` para visita anônima.
- [x] [BACKEND] Step 22: `SecurityConfig` liberando endpoints públicos/autenticados corretos.
- [x] [BACKEND] Step 23: `GlobalExceptionHandler` cobre exceções novas.

## Fase 5 — UI / Telas mobile / Rotas (Mobile)

- [x] [MOBILE] Step 24 `[E2-01/E2-02]`: `GeofencingTaskService.js` — `TaskManager.defineTask` +
  `startGeofencingAsync`/`stopGeofencingAsync` com regiões de ~120m a partir do centroide do
  geofence de cada hospital próximo; tolerâncias RN-01 (2min)/RN-03 (5min) aplicadas em memória
  via `setTimeout` por hospital, já que os eventos nativos disparam uma única vez.
- [x] [MOBILE] Step 25 `[E2-01/E2-02]`: `VisitaService.js` (cliente HTTP completo).
- [x] [MOBILE] Step 26 `[E2-09]`: heartbeat periódico (30 min) — `HeartbeatService.js` com
  `setInterval` em foreground (heartbeat nativo em background fica fora de escopo deste commit;
  a ausência de sinal em background é coberta pelo job do backend + pelo `GeofencingTaskService`).
- [x] [MOBILE] Step 27 `[E2-06]`: `CheckinManualScreen` (fallback sem GPS).
- [x] [MOBILE] Step 28 `[E2-07]`: `CSGeoStatusCard` (cronômetro + "Não estou aqui"); notificação persistente ⚠️ pendente.
- [x] [MOBILE] Step 29 `[E2-04]`: tratamento de conflito 409 — `CheckinManualScreen` exibe
  `Alert` com os `candidatos` e reenvia o check-in com o `hospitalId` escolhido; `VisitaService`
  anexa `status`/`data` ao erro lançado para permitir esse tratamento; `GeofencingTaskService`
  ignora silenciosamente o 409 (sem UI em background) e deixa o usuário resolver manualmente.
- [x] [MOBILE] Step 30 `[E2-05]`: estado "Recuperando localização..."/`GPS_INTERROMPIDO` —
  `CSGeoStatusCard` vira somente leitura ("Localização perdida - visita encerrada
  automaticamente") quando `visita.status === "GPS_INTERROMPIDO"`.
- [x] [MOBILE] Step 31 `[E2-10]`: prompt de tipo de permanência (12h) — implementado com
  `Alert.alert` (Observação/Internação) ao focar a `HomeScreen`, quando a visita ativa já
  passou de 12h e não tem `tipoPermanencia`; escolhido por consistência com o padrão de
  confirmações já usado no app (`Alert.alert`), em vez de agendar notificação local via
  `expo-notifications` (mais complexo e não coberto por outro fluxo do app).
- [x] [MOBILE] Step 32: rotas em `App.js` (`VisitasStack`) + botão "Estou em um hospital" na `HomeScreen`.
- [x] [MOBILE] Step 33: avaliada substituição de `watchPositionAsync` (ADR-002) — mantido como
  ferramenta de depuração/mapa; ciclo de vida das visitas passou para `GeofencingTaskService`.
  Comentário adicionado no topo de `GeoLocalizacaoScreen.js` referenciando a decisão.

## Fase 6 — Validação / DoD (transversal, após Fases 1–5)

- [ ] [BACKEND] Step 34: testes de unidade/integração dos jobs de expiração e suspeita.
- [ ] [MOBILE] Step 35: teste manual de campo (geofence real).
