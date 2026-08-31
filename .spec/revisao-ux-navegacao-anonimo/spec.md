# Spec — Revisão de UX, Navegação e Modo Anônimo (7 itens)

Origem: análise conduzida em conjunto com o usuário (screenshots + descrição). Todos os itens pertencem ao app React Native/Expo (`frontend/`) com apoio pontual no backend Spring Boot (`backend/`).

## Itens

1. **Botão "Entrar" (Perfil) sem ação.** Na `PerfilScreen`, o helper `irPara` navega no navigator **pai** (Tab), que não possui as rotas `Login`/`Cadastro`/`Privacidade` (elas vivem no `PerfilStack`). O `navigate` sobe até o `Tab.Navigator` e é engolido — botão não faz nada.
2. **Botão "Criar conta" (Perfil) sem ação.** Mesma causa do item 1 (rota `Cadastro` está no `PerfilStack`).
3. **Check-in/check-out anônimo (manual ou geolocalização) sem login.** O backend exige `dispositivoId` para check-in anônimo (`VisitaServiceImpl.checkin`), mas o app nunca envia esse campo. Além disso, `GET /api/v1/visitas/ativas` exige autenticação — o modo anônimo não consegue recuperar a visita ativa. O usuário não deve precisar "identificar o dispositivo" manualmente: o app gera e persiste um id anônimo interno.
4. **Check-in manual dispara todos os botões "Estou aqui" + erro de autenticação.** Em `CheckinManualScreen`, o estado `enviando` é único e compartilhado por todos os cartões → todos os botões entram em loading. O erro de autenticação é o item 3 (falta `dispositivoId`).
5. **Mapa deve exibir todos os hospitais cadastrados.** `GeoLocalizacaoScreen` renderiza apenas o marker do usuário (e um placeholder no Brasil). Não carrega a lista de hospitais.
6. **Disposição dos botões "Entrar"/"Criar conta" (UI/UX).** Atualmente dois botões empilhados de largura total. Redesenhar como dupla em linha, com hierarquia visual primária/secundária.
7. **Voltar à aba Hospitais deve reexibir a lista (não o detalhe memorizado).** Ao abrir `HospitalDetalhe` e trocar de aba, o stack aninhado mantém o detalhe no topo. Ao retornar à aba, deve voltar para `HospitaisLista`.

## Critérios de aceite

- [ ] Sem sessão (`TokenStorage.getAccessToken() == null`), `VisitaService.checkin` envia `dispositivoId` automaticamente.
- [ ] Sem sessão, `VisitaService.buscarAtiva` consulta via `dispositivoId` e o backend devolve a visita ativa anônima.
- [ ] `CheckinManualScreen`: apenas o botão tocado mostra loading; os demais ficam desabilitados durante o envio.
- [ ] `GeoLocalizacaoScreen`: exibe markers de todos os hospitais ativos (nome visível) e ajusta o enquadramento.
- [ ] Botões "Entrar"/"Criar conta" na `PerfilScreen`: navegam corretamente e têm layout revisado.
- [ ] A aba Hospitais reabre na lista ao voltar de outra aba.
- [ ] Suítes existentes seguem verdes: frontend `jest` + `tsc --noEmit`; backend `gradlew build`.