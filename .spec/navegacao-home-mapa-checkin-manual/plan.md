# Plano — Revisão de Navegação (Home Apresentação + Mapa Aba + Check-in Manual)

Ordem das dependências: Navegação (App.js) → Home (remover UI) → Componente de card → Lista de hospitais (fluxo de check-in) → Detalhe (temporizador/checkout) → Testes.

## Passos

- [x] Step 1: `App.js` — adicionar 4ª aba "Mapa" (`GeoLocalizacaoScreen` direto como componente de aba, ícone `MapIcon`) entre Hospitais e Perfil.
- [x] Step 2: `App.js` — `HomeStack` passa a conter apenas `Home` (remover rotas `CheckinManual` e `Geolocalizacao`); remover import ocioso de `CheckinManualScreen`.
- [x] Step 3: `HomeScreen.js` — reescrever como tela de apresentação: remover `CSGeoStatusCard`, blocos de carregamento/erro e `actionsRow`; **manter** `iniciarGeofencing()` (useEffect) e a reidratação silenciosa da visita ativa (`useFocusEffect` + `sincronizarVisitaAtiva` + heartbeat) para preservar o ciclo de vida da visita.
- [x] Step 4: `CSHospitalCard.js` — adicionar props opcionais `onCheckin`, `checkinLoading`, `checkinAtivo` e renderizar botão compacto de check-in (Pressable aninhado com `stopPropagation`); estilos novos (`checkinButton*`, `checkinText*`).
- [x] Step 5: `HospitaisScreen.js` — integrar fluxo: `buscarAtiva()` no foco, `fazerCheckin()` com `origem: "MANUAL"`, tratamento de conflito 409 (geofences), e redirecionamento para `HospitalDetalhe`; passar `onCheckin`/`checkinLoading`/`checkinAtivo` ao card.
- [x] Step 6: `HospitalDetalheScreen.js` — adicionar detecção de visita ativa `MANUAL` do hospital (via `buscarAtiva()` no foco), temporizador hh:mm:ss (update a cada segundo) e botão "Não estou aqui" (checkout + `agendarFeedback`); bloco condicionado a `origem === "MANUAL"` e `hospitalId` correspondente.
- [x] Step 7: `App.test.js` — atualizar para 4 abas e novos `tabBarAccessibilityLabel` (Início "apresentação do app", novo Mapa).
- [x] Step 8: Verificação — `tsc --noEmit` e `jest` verdes.
