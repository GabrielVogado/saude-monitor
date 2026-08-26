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

---

## Fase 0 — Pré-requisitos e dependências

- [ ] [BACKEND] Step 1: Confirmar `@EnableScheduling` disponível (não há dependência extra no
  `build.gradle` — `spring-boot-starter-webmvc`/`data-mongodb` já bastam) para o job de
  expiração (E2-03) e o job de marcação `SUSPEITA` (E2-09).
- [ ] [MOBILE] Step 2: Adicionar dependências ao `frontend/package.json`: `expo-task-manager`
  (geofencing nativo em background, E2-01/E2-02), `expo-notifications` (card persistente E2-07 e
  prompt de internação E2-10). Executar `expo install` para resolver versões compatíveis com
  `expo ~55`.
- [ ] [MOBILE] Step 3: Atualizar `frontend/app.json`: adicionar permissão Android
  `ACCESS_BACKGROUND_LOCATION`; configurar o plugin `expo-location` com
  `locationAlwaysAndWhenInUsePermission` (iOS) e `isAndroidBackgroundLocationEnabled: true`;
  adicionar `NSLocationAlwaysAndWhenInUseUsageDescription` em `ios` (texto pt-BR justificando o
  uso, conforme risco de restrição iOS documentado em F-03); adicionar plugin/config de
  `expo-notifications` se exigido pela versão do SDK.

## Fase 1 — Tipos e modelos de domínio (Backend)

- [ ] [BACKEND] Step 4: Criar módulo `br.com.saude_monitor.api.visita` com subpastas
  `document/dto/repository/service/service/impl/controller`, replicando a estrutura de
  `hospital`.
- [ ] [BACKEND] Step 5: Criar enums de domínio em `visita/document`:
  `StatusVisita` (`EM_ATENDIMENTO, SUSPEITA, FINALIZADA, EXPIRADA, GPS_INTERROMPIDO`),
  `OrigemVisita` (`GEOFENCE, MANUAL`), `TipoPermanencia` (`ATENDIMENTO, OBSERVACAO, INTERNACAO`) —
  cobrem todas as estórias E2-01 a E2-10 desde já, evitando retrabalho de schema entre S2 e S3.
- [ ] [BACKEND] Step 6: Criar DTOs de request/response em `visita/dto`, alinhados a
  `Especificacao-API-v2.0.md §3.3`: `PosicaoDto` (GeoJSON Point reaproveitando padrão de
  `GeoJsonPolygonDto`), `CheckinRequest` (`hospitalId, origem, posicao, dispositivoId`),
  `VisitaResponse` (campos completos incl. `tipoPermanencia`, `ultimoHeartbeat`, `origem`),
  `CheckinResponse`, `CheckoutRequest`/`CheckoutResponse`, `HeartbeatResponse`,
  `TipoPermanenciaRequest`, `VisitaAtivaResponse` (`visita: VisitaResponse | null`).

## Fase 2 — Modelo de banco / Documents (Backend)

- [ ] [BACKEND] Step 7: Criar `VisitaDocument` (`@Document(collection = "visitas")`) com todos os
  campos do schema §2.3: `usuarioId` (nullable — visita anônima via `dispositivoId`),
  `hospitalId`, `entrada`, `saida`, `duracaoMinutos`, `status`, `tipoPermanencia`,
  `ultimoHeartbeat`, `origem`, `dispositivoId`, `pontosAmostrais` (lista de
  `{posicao: GeoJsonPoint, em: Instant}` — usado por E2-05), `encerramentoManual` (boolean, E2-07),
  `notas`, `criadoEm`. Full schema criado de uma vez (S2 usa o subconjunto básico; S3
  complementa comportamento, não schema).
- [ ] [BACKEND] Step 8: Anotar índices conforme spec: `{hospitalId:1, entrada:-1}`,
  `{usuarioId:1, entrada:-1}`, `{status:1}`, `{ultimoHeartbeat:1}` via `@CompoundIndex`/`@Indexed`
  — o índice em `ultimoHeartbeat` é crítico para a varredura do job de expiração (E2-03/E2-09).
- [ ] [BACKEND] Step 9: Criar `VisitaRepository extends MongoRepository<VisitaDocument, String>`
  com métodos derivados: `findByUsuarioIdAndStatus`, `findByDispositivoIdAndStatus`,
  `findByHospitalIdAndStatus`, `findByStatusInAndUltimoHeartbeatBefore` (para o job de
  expiração/suspeita).

## Fase 3 — Services / Integrações (Backend) — ordem de sprint S2 → S3

> Sprint S2 (detecção básica + heartbeat) primeiro; dentro de S2, heartbeat (E2-09) é
> pré-requisito lógico do job de expiração de S3 (E2-03).

- [ ] [BACKEND] Step 10 `[E2-01]`: Implementar `VisitaService.checkin(...)` — valida (via
  `MongoTemplate`/`Criteria` + `$geoIntersects`, reaproveitando o padrão de
  `HospitalServiceImpl`) se `posicao` está dentro do geofence do hospital quando
  `origem=GEOFENCE`; regra dos **2 minutos contínuos** é responsabilidade do app (RN-01) — o
  backend apenas recebe o evento já validado pelo dispositivo e cria a visita
  `EM_ATENDIMENTO`; idempotência: se já existe visita `EM_ATENDIMENTO` do mesmo
  usuário/dispositivo no mesmo hospital, retorna a existente (201/200 conforme já
  existir).
- [ ] [BACKEND] Step 11 `[E2-02]`: Implementar `VisitaService.checkout(id, posicao)` —
  regra dos **5 minutos fora** é decidida no app (RN-03); o backend recebe o evento de
  saída, define `saida = now`, calcula `duracaoMinutos`, define `status = FINALIZADA`.
- [ ] [BACKEND] Step 12 `[E2-06]`: Implementar variante de `checkin` para `origem = MANUAL`
  (sem validação `$geoIntersects` — usuário seleciona hospital manualmente); marcar
  documento com `origem = MANUAL` (fallback de GPS desligado/permissão negada).
- [ ] [BACKEND] Step 13 `[E2-07]`: Implementar `VisitaService.buscarAtiva(usuarioId | dispositivoId)`
  (para `GET /visitas/ativas`) e `VisitaService.listarHistoricoUsuario(...)` paginado (suporte ao
  card de visita ativa e ao histórico consumido pelo mobile).
- [ ] [BACKEND] Step 14 `[E2-09]`: Implementar `VisitaService.heartbeat(id)` — atualiza
  `ultimoHeartbeat = now`; se `status == SUSPEITA`, retorna a `EM_ATENDIMENTO` (RN-23).
  Implementar `VisitaSuspeitaJob` (`@Scheduled`, ex. a cada 15 min, mesmo cron-base do job de
  expiração) que marca `SUSPEITA` toda visita `EM_ATENDIMENTO` com `ultimoHeartbeat` há mais de
  2h. **Esta etapa é pré-requisito obrigatório da Fase 3 seguinte (E2-03).**
- [ ] [BACKEND] Step 15 `[E2-03]` (depende do Step 14): Implementar `VisitaExpiracaoJob`
  (`@Scheduled`, a cada 15 min) que varre `status IN (EM_ATENDIMENTO, SUSPEITA)` com
  `ultimoHeartbeat` há mais de 24h e marca `EXPIRADA`, preservando `duracaoMinutos` parcial
  (calculado a partir de `ultimoHeartbeat`, não de `now`, conforme RN-04). Reaproveita o índice
  `{ultimoHeartbeat:1}` do Step 8.
- [ ] [BACKEND] Step 16 `[E2-04]`: Implementar `ConflitoGeofenceResolver` — quando
  `$geoIntersects` no checkin retorna mais de um hospital, desempatar por `$near`/distância ao
  centróide (reaproveitar `GeofenceFactory.calcularCentroide`); se diferença de distância ≤ 10m
  (empate), `VisitaService.checkin` retorna resposta especial (`409`/campo `candidatos`) para o
  app perguntar em 1 toque, sem criar visita.
- [ ] [BACKEND] Step 17 `[E2-05]`: Estender `checkout`/heartbeat para registrar
  `pontosAmostrais` a cada evento recebido; adicionar `VisitaGpsInterrompidoJob` (ou lógica no
  mesmo scheduler do Step 15) que, quando não há novo evento de posição por 10 min durante uma
  visita ativa (sinal diferente de heartbeat — GPS específico), encerra com
  `status = GPS_INTERROMPIDO` e duração parcial.
- [ ] [BACKEND] Step 18 `[E2-10]`: Implementar `VisitaService.definirTipoPermanencia(id, tipo)`
  — validação de negócio (`ValidacaoNegocioException`) exigindo que a visita tenha ≥ 12h de
  duração (`entrada` até `now`); grava `tipoPermanencia` sem alterar `status` (visita continua
  ativa).
- [ ] [BACKEND] Step 19 `[E2-08]`: Implementar filtro de agregação — método/consulta que exclui
  visitas com `duracaoMinutos < 2` das estatísticas públicas (reaproveitado futuramente por F-06);
  no Épico 2, expor apenas via flag no `VisitaResponse`/query interna, já que o job de agregação
  em si pertence ao Épico 3/F-06.

## Fase 4 — Controllers / Endpoints REST (Backend)

- [ ] [BACKEND] Step 20: Criar `VisitaController` (`@RequestMapping("/api/v1/visitas")`) com:
  `POST /checkin` (E2-01/E2-06), `POST /{id}/checkout` (E2-02/E2-05), `POST /{id}/heartbeat`
  (E2-09), `PATCH /{id}/tipo-permanencia` (E2-10), `GET /ativas` (E2-07), e endpoint auxiliar
  `GET /api/v1/usuarios/me/visitas` (histórico, pode residir no `UserController` ou em
  `VisitaController` dependendo da convenção final — decidir na implementação seguindo o
  path da spec).
- [ ] [BACKEND] Step 21: Usar `AutenticacaoHelper.usuarioIdAtual()` para resolver o usuário
  logado nos endpoints protegidos; permitir `dispositivoId` no corpo de `checkin` para suportar
  visita anônima (usuário não logado), conforme spec.
- [ ] [BACKEND] Step 22: Atualizar `SecurityConfig` — liberar `POST /api/v1/visitas/checkin`,
  `POST /api/v1/visitas/{id}/checkout`, `POST /api/v1/visitas/{id}/heartbeat` para usuários
  autenticados OU anônimos com `dispositivoId` (avaliar `permitAll()` com validação de
  `dispositivoId` no service, já que a spec permite visita sem login); manter
  `GET /api/v1/visitas/ativas` e `PATCH .../tipo-permanencia` como `authenticated()`.
- [ ] [BACKEND] Step 23: Garantir que `GlobalExceptionHandler` já cobre os erros de negócio
  novos (`ValidacaoNegocioException` para "visita não atingiu 12h", `RecursoNaoEncontradoException`
  para visita/hospital inexistente) — nenhuma alteração estrutural esperada, apenas reuso.

## Fase 5 — UI / Telas mobile / Rotas (Mobile)

> Depende de todos os endpoints da Fase 4 estarem disponíveis (mesmo que via mock/contract
> inicial, para desenvolvimento em paralelo).

- [ ] [MOBILE] Step 24 `[E2-01/E2-02]`: Criar `src/screens/visitas/service/GeofencingTaskService.js`
  — registra `TaskManager.defineTask` + `Location.startGeofencingAsync` com as regiões dos
  hospitais próximos (buscadas via `HospitalService.listar`); implementa os timers de tolerância
  de **2 min contínuos** (entrada) e **5 min contínuos** (saída) no dispositivo antes de disparar
  o evento à API (RN-01/RN-03) — substitui o uso de `watchPositionAsync` para o cenário de
  monitoramento contínuo em `GeoLocalizacaoScreen` (ADR-002).
- [ ] [MOBILE] Step 25 `[E2-01/E2-02]`: Criar `src/screens/visitas/service/VisitaService.js`
  (cliente HTTP seguindo o padrão de `HospitalService.js`/`TokenStorage.js`): métodos
  `checkin(payload)`, `checkout(id, posicao)`, `heartbeat(id)`, `definirTipoPermanencia(id, tipo)`,
  `buscarAtiva()`, `listarHistorico(...)`.
- [ ] [MOBILE] Step 26 `[E2-09]`: Implementar disparo de heartbeat a cada 30 min enquanto houver
  visita ativa (background task adicional ou `setInterval` quando app em foreground + task
  agendada em background), chamando `VisitaService.heartbeat`.
- [ ] [MOBILE] Step 27 `[E2-06]`: Criar tela `CheckinManualScreen` (fallback GPS desligado/permissão
  negada) — lista hospitais por proximidade (reaproveita `HospitalService.listar`), botão
  "Estou em um hospital" na Home aciona a tela; seleção chama `VisitaService.checkin` com
  `origem: "MANUAL"`.
- [ ] [MOBILE] Step 28 `[E2-07]`: Criar componente `CSGeoStatusCard` (glass card sobre a Home/mapa,
  cronômetro `display-sm`/tabular-nums, `accessibilityLiveRegion="polite"`, botão "Não estou
  aqui" chamando `checkout` com `encerramentoManual = true`); exibido quando
  `VisitaService.buscarAtiva()` retorna visita não nula; disparar notificação local persistente
  via `expo-notifications` enquanto a visita estiver ativa.
- [ ] [MOBILE] Step 29 `[E2-04]`: Tratar resposta de conflito (`409`/`candidatos`) do
  `checkin` na UI: exibir prompt de 1 toque "Você está em X ou Y?" com as duas opções de
  hospital, reenviando o `checkin` com o `hospitalId` escolhido.
- [ ] [MOBILE] Step 30 `[E2-05]`: Ajustar `GeofencingTaskService`/card para exibir estado
  "Recuperando localização..." quando o GPS cair durante visita ativa, e refletir status
  `GPS_INTERROMPIDO` retornado pelo backend (sem encerrar a UI abruptamente).
- [ ] [MOBILE] Step 31 `[E2-10]`: Implementar notificação local/prompt "Você está em observação
  ou internado?" disparado 12h após `entrada` da visita ativa; resposta chama
  `VisitaService.definirTipoPermanencia`.
- [ ] [MOBILE] Step 32: Registrar novas telas/fluxos em `App.js` (ex.: `CheckinManualScreen`
  dentro de um novo `VisitasStack`, seguindo o padrão de `HospitaisStack`); adicionar entrada
  "Estou em um hospital" na `HomeScreen`.
- [ ] [MOBILE] Step 33: Avaliar e, se necessário, remover/substituir o uso de
  `watchPositionAsync` em `GeoLocalizacaoScreen`/`GeoLocalizacaoService.js` pelo novo
  `GeofencingTaskService`, conforme decisão ADR-002 registrada em F-03 (pode ser adiado para
  não quebrar telas existentes fora do escopo do Épico 2 — registrar decisão explicitamente no
  PR).

## Fase 6 — Validação / DoD (transversal, após Fases 1–5)

- [ ] [BACKEND] Step 34: Testes de unidade/integração dos jobs de expiração e suspeita com
  dataset simulado de heartbeats (conforme DoD de F-03: teste de estresse com visitas
  simuladas).
- [ ] [MOBILE] Step 35: Teste manual de campo (ao menos 1 hospital real) para calibrar raio do
  geofence, tempo de detecção de entrada/saída e consumo de bateria, conforme DoD de F-03/F-04.
