# Plano de Implementação — Sprint S8 (Pendências / Stretch do MVP Mobile)

> Referência: `Documentos/06-sprints/Plano-Sprints-v2.0.md` §21 · 15 story points · 5 estórias
> Git-flow: `Documentos/git-flow/MANUAL.md` §3.1 — uma branch `feature/*` por estória, PR para `develop`.

## Decisões de escopo (validadas com o PO em 01/09/2026)

| # | Decisão |
|---|---|
| 1 | Uma branch + PR por ID de estória, com commits separados. Ordem de merge: E4-05 → F-07 → E5-03 → E5-05 → E6-05. |
| 2 | E5-05 inclui novo endpoint `PUT /api/v1/contas/consentimentos` (auditoria da revogação, LGPD art. 8º §5º). |
| 3 | E5-03 exporta **PDF** (não CSV) gerado **no backend** — mais acessível ao cidadão. Endpoint `GET /api/v1/contas/export/pdf` (`application/pdf`). |
| 4 | F-07 usa `@maplibre/maplibre-react-native` (`GeoJSONSource` + `Layer`), não `react-native-maps` — o plano v2.0 está desatualizado (migração do PR #45). |

---

## E4-05 — UI de Ranking de Hospitais (3 pts, FE)
**Branch:** `feature/e4-05-ui-ranking` · Backend pronto (`HospitalController.java:73`)

- [x] Step 1: Adicionar `HospitalService.ranking({ ordem, tipo, page, size })` consumindo `GET /api/v1/hospitais/ranking`.
- [x] Step 2: Criar `src/screens/hospitais/view/RankingScreen.js` — lista ordenável por NOTA/TEMPO, filtro por tipo (público/privado), paginação incremental, estados loading/erro/empty (E6-03) e tokens do Design System (E6-02).
- [x] Step 3: Registrar a rota `Ranking` no `HospitaisStack` (`App.js`) e o acesso a partir de `HospitaisScreen`.
- [x] Step 4: Testes (`src/__tests__/screens/hospitais/RankingScreen.test.js`) + `HospitalService.ranking`.

## F-07 — Mapa completo: geofences + filtro por raio (3 pts, FE)
**Branch:** `feature/f-07-mapa-geofences-filtro-raio`

- [x] Step 1: Estender `src/utils/geojson.js` com helper de FeatureCollection dos geofences para o MapLibre.
- [x] Step 2: Renderizar polígonos das geofences em `GeoLocalizacaoScreen` via `GeoJSONSource` + `Layer` (`fill` e `line`).
- [x] Step 3: Filtro por raio (chips 1/5/10/25 km + "Todos") consumindo `GET /api/v1/hospitais?latitude&longitude&raioKm`.
- [x] Step 4: Toque no polígono/marker abre o `HospitalDetalhe`.
- [x] Step 5: Testes de `geojson` e da tela do mapa.

## E5-03 — Exportação de dados em PDF (3 pts, BE + FE)
**Branch:** `feature/e5-03-exportacao-dados-pdf` · Histórico (UI) já entregue na v3.4

- [x] Step 1: Adicionar dependência de geração de PDF ao `backend/build.gradle`.
- [x] Step 2: Criar `ExportacaoPdfService` (porta) + `impl` que monta o relatório LGPD (perfil, consentimentos, visitas, feedbacks) a partir do mesmo agregado de `UserService.exportarDados`.
- [x] Step 3: Expor `GET /api/v1/contas/export/pdf` no `ContaController` devolvendo `application/pdf` + `Content-Disposition: attachment`.
- [x] Step 4: Teste do serviço de PDF (bytes válidos, cabeçalho `%PDF`) e do controller.
- [x] Step 5: Frontend — `PerfilService.exportarDadosPdf()` com download/compartilhamento (`expo-file-system` + `expo-sharing`) e fallback web.
- [x] Step 6: Botão "Exportar meus dados (PDF)" na `HistoricoScreen` com estados de progresso/erro.
- [x] Step 7: Testes frontend do fluxo de exportação.

## E5-05 — Revogação nativa completa do consentimento (2 pts, BE + FE)
**Branch:** `feature/e5-05-revogacao-consentimento-nativa`

- [x] Step 1: Criar `AtualizarConsentimentosRequest` (record) com as finalidades `localizacao`/`notificacoes` e `versaoTermos`.
- [x] Step 2: Adicionar `UserService.atualizarConsentimentos(usuarioId, request)` + impl gravando `aceito`/`data`/`versao` no `ConsentimentosDocument`.
- [x] Step 3: Expor `PUT /api/v1/contas/consentimentos` no `ContaController`.
- [x] Step 4: Testes backend do endpoint (200, 401 sem token).
- [x] Step 5: Frontend — `PerfilService.atualizarConsentimento()` + `Linking.openSettings()` na revogação, com sincronização do estado após retorno do SO (`AppState`).
- [x] Step 6: Testes frontend da revogação.

## E6-05 — Tela dedicada de opt-in de notificações (2 pts, FE)
**Branch:** `feature/e6-05-optin-notificacoes`

- [x] Step 1: Extrair helpers de permissão de notificação de `FeedbackNotificationService` para uso fora do fluxo E3.
- [x] Step 2: Criar `src/screens/perfil/view/NotificacoesScreen.js` — explicação da finalidade, toggle de opt-in, encaminhamento ao SO quando negado.
- [x] Step 3: Registrar rota `Notificacoes` no `PerfilStack` e o acesso pelo `PerfilScreen`.
- [x] Step 4: Persistir o opt-in via `PUT /api/v1/contas/consentimentos` (depende de E5-05) quando houver sessão.
- [x] Step 5: Testes da tela de notificações.

---

## DoD do sprint (§21.5)
- [x] Suíte de testes frontend 100% verde (`npm test`) + `npm run typecheck` sem erros.
- [x] Build backend verde (`./gradlew build`).
- [x] `Documentos/05-features/Relatorio-Aderencia-Codigo-vs-Features.md` atualizado (v3.5) com a entrega da S8.
