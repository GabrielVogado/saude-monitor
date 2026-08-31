# Plan — Revisão de UX, Navegação e Modo Anônimo

Ordem de dependência: infra de dispositivo → serviços → backend → telas → navegação → testes/validação.

- [x] Step 1: `DispositivoId` — serviço de identificação anônima de dispositivo (gera e persiste UUID em AsyncStorage).
- [x] Step 2: `VisitaService` — anexa `dispositivoId` automaticamente no `checkin` quando anônimo.
- [x] Step 3: Backend — `GET /api/v1/visitas/ativas` aceita `dispositivoId` para recuperar visita ativa anônima (`VisitaController`, `VisitaService`, `VisitaRepository`, `SecurityConfig`).
- [x] Step 4: `CheckinManualScreen` — estado `enviandoId` por hospital (um botão por vez em loading).
- [x] Step 5: `PerfilScreen` — corrige navegação para `Login`/`Cadastro`/`Privacidade` (navega no stack correto) e redesenha a dupla "Entrar"/"Criar conta".
- [x] Step 6: `GeoLocalizacaoScreen` — carrega todos os hospitais ativos e renderiza markers com nome; enquadra a câmera.
- [x] Step 7: `App.js` — aba Hospitais volta para `HospitaisLista` ao ser reaberta (pop-para-topo do stack aninhado).
- [x] Step 8: Testes — backend (novo `VisitaServiceImplTest` + `gradlew build` = 104 testes) e frontend (`DispositivoId`), `tsc --noEmit` e `jest` (17 suítes/104 testes).