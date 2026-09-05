# 🗺️ Mapeamento De-Para: Backlog vs Features (MVP v2.1)

Este documento estabelece o mapeamento direto entre as **Estórias de Usuário (Backlog)** e as **Features** da arquitetura do MVP.

> **Última verificação: 02/09/2026, contra `develop@f26666e`.** A versão anterior deste arquivo (30/08/2026, preservada em `_historico/De-Para-Backlog-Features-v2.md`) precedia a **Sprint S8** e marcava como "Parcial" seis estórias que hoje estão entregues: **E3-02**, **E3-03**, **E4-05**, **E5-03**, **E5-05** e **E6-05**.
>
> **Escopo:** todas as estórias do backlog. O **Épico 7 / Painel Administrativo Web (F-11)** foi **adiado por decisão do Product Owner em 02/09/2026** (D-01, `Backlog-MVP-v2.1.md` §2.1) — continua listado, agora como P2 fora do caminho crítico.

## Placar

| Escopo | Entregue | Total | % |
|---|---|---|---|
| Aplicativo (Fase 0 + Épicos 1–6) | 42 | 43 | **98%** |
| Painel Administrativo Web (Épico 7) | 0 | 9 | 0% (adiado) |
| **Total do backlog** | **42** | **52** | **81%** |
| Épico 8 — Estabilização e Desempenho (novo, v2.1) | 4 | 15 | 27% |

> ⚠️ **Entregue ≠ utilizável.** As 42 estórias abaixo estão implementadas e cobertas por teste em CI, mas o sistema **não passou por validação em campo** e apresenta lentidão transversal de origem confirmada na infraestrutura (109 s na primeira abertura, 1–5 s por requisição com o serviço quente). Ver `Features-MVP-v2.1.md` §2.1 e o **Épico 8** do `Backlog-MVP-v2.1.md`.

## Fase 0 — Estabilização e Segurança
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **F0-01** | Hash BCrypt para senhas | **F-02**, **F-09** | ✅ Existente (Seguro) |
| **F0-02** | Autenticação via JWT | **F-02** | ✅ Existente (login/refresh/logout; refresh rotaciona e **logout revoga o refresh na blacklist** — PR `feature/logout-server-revogacao-refresh`) |
| **F0-03** | Padronizar envelope de erro | **F-09** | ✅ Existente |
| **F0-04** | Rate limiting | **F-09** | ✅ Existente (PR #24 — login/refresh > 10/min/IP e públicos > 60/min/IP retornam 429 no envelope padrão) |
| **F0-05** | Exclusão de conta (LGPD) | **F-02**, **F-09** | ✅ Existente (PR #25 — `DELETE /api/v1/contas/exclusao` com cascade: remove user + `auth_logins`, anonimiza visitas/feedbacks e recalcula agregados) |

## Épico 1 — Cadastro de Hospitais e Geofences
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E1-01** | Cadastrar hospital (Admin) | **F-01** | ✅ Existente (Protegido Admin) |
| **E1-02** | Definir geofence (Admin) | **F-01** | ✅ Existente (Via endpoints Admin) |
| **E1-03** | Listar hospitais (Público) | **F-01**, **F-07** | ✅ Existente (340 importados) |
| **E1-04** | Editar/Desativar hospital | **F-01** | ✅ Existente |
| **E1-05** | Sugerir hospital | **F-07** | ✅ Existente (tela pública + endpoint público) |
| **E1-06** | Revisar/aprovar/rejeitar sugestão | **F-10** | ✅ Backend no escopo (endpoints aprovar/rejeitar, PR #14) + telas mobile existem. O fluxo de aprovação mobile migra ao **Painel Web (S7/F-11)** — fora do escopo S0–S6 |

## Épico 2 — Detecção de Visitas (Geofence)
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E2-01** | Detecção entrada automática | **F-03** | ✅ Existente (geofencing nativo) |
| **E2-02** | Detecção saída automática | **F-03** | ✅ Existente |
| **E2-03** | Expirar visitas > 24h | **F-03** | ✅ Existente (job `EXPIRADA`) |
| **E2-04** | Tratar conflito sobreposição | **F-03** | ✅ Existente (hospital mais próximo) |
| **E2-05** | Recuperar GPS interrompido | **F-03** | ✅ Existente (timeout 10min) |
| **E2-06** | Check-in manual (Plano B) | **F-04** | ✅ Existente |
| **E2-07** | Ver visita ativa (app) | **F-04** | ✅ Existente (card + cronômetro) |
| **E2-08** | Ignorar visitas < 2 minutos | **F-04** | ✅ Existente (RN-07): síntese em `develop` não salvava; **corrigido** em `bugfix/ajustes-rn-feedback-estatisticas` (`DURACAO_MINIMA_MINUTOS=2` no `AgregadoServiceImpl`, filtro `>= 2min` + teste — commit `3ad5bf9`) |
| **E2-09** | Enviar heartbeat 30 min | **F-03**, **F-04** | ✅ Existente |
| **E2-10** | Prompt observação/internação | **F-04** | ✅ Existente (após 12h) |

## Épico 3 — Feedback Pós-Saída
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E3-01** | Notificação de feedback 1-5m | **F-05** | ✅ Existente |
| **E3-02** | Form < 45s (4 perguntas) | **F-05** | ✅ Existente — os três desvios de RN foram corrigidos: **select searchable** de especialidade com lista curada (RN-10), ramificação **"triagem ≠ Sim → pula a Tela 2"** (RN-11) e opção **"Não interagi"** zerando `tratamentoEquipe`. Verificado em `FeedbackFormScreen.js` + `FeedbackFormScreen.test.js` |
| **E3-03** | Responder em 24h + lembrete | **F-05** | ✅ Existente — janela de 24h, lembrete **único agendado em ~6h** (alinhado à doc, `FeedbackNotificationService.js`) e job `SEM_FEEDBACK` |
| **E3-04** | Bloquear feedback duplicado | **F-05** | ✅ Existente (unique `visitaId`) |
| **E3-05** | Feedback anônimo | **F-05** | ✅ Existente (`usuarioId` nulo) |
| **E3-06** | Agradecimento e impacto | **F-05** | ✅ Existente |

## Épico 4 — Indicadores Públicos por Hospital
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E4-01** | Ver nota média do hospital | **F-06** | ✅ Existente (agregado + média 90d) |
| **E4-02** | Ver tempo médio do hospital | **F-06** | ✅ Existente (mediana) |
| **E4-03** | Detalhe público hospital | **F-06** | ✅ Existente (`/hospitais/{id}/indicadores` + tela) |
| **E4-04** | Atualizar agregados 15min | **F-06** | ✅ Existente (job + evento) |
| **E4-05** | Ranking hospitais | **F-06** | ✅ Existente — backend (PR #27: `GET /api/v1/hospitais/ranking` por NOTA/TEMPO + filtro de tipo + paginação) **e UI** (`RankingScreen`, S8) |
| **E4-06** | Tendência simples | **F-06** | 🔴 **Pendente** — P2, sem sprint atribuída. **Única estória funcional do app ainda não entregue**; não bloqueia o lançamento |

## Épico 5 — Conta, Consentimento e Privacidade
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E5-01** | Permissão localização etapas | **F-09** | 🟢 Implementado (FE: Perfil → Dados e Privacidade, consulta/solicita/revoga) |
| **E5-02** | Termos de privacidade LGPD | **F-09** | 🟢 Implementado (FE: tela Privacidade/Termos acessível em 2 toques; selo HIPAA removido) |
| **E5-03** | Histórico pessoal visitas/fb | **F-02** | ✅ Existente — backend (`GET /contas/visitas`, `/contas/feedbacks`, `/contas/export`) + **UI** `HistoricoScreen` + **exportação em PDF** (S8: `GET /contas/export/pdf`, OpenPDF, com download e compartilhamento no app — escolhida no lugar de CSV por acessibilidade à população, LGPD art. 18) |
| **E5-04** | Cadastro/login opcional | **F-02** | 🟢 Implementado (FE: conta opcional na jornada principal; Perfil orienta Login/Cadastro) |
| **E5-05** | Revogar consentimento LGPD | **F-09** | ✅ Existente — revogação no Perfil **auditada no servidor** (S8: `PUT /api/v1/contas/consentimentos`, LGPD art. 8º §5º) + desligamento nativo que leva às configurações do SO e resincroniza no retorno ao app |

## Épico 6 — Experiência e Polimento (Cross)
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E6-01** | Navegação Bottom Tabs | **F-07** | ✅ Existente — **4 abas** (Início/Hospitais/**Mapa**/Perfil) substituindo o Drawer; a aba Mapa foi acrescentada depois da S6, quando o mapa deixou de ser um botão na Home |
| **E6-02** | Design System v2.0 | **F-08** | 🟢 Implementado (S6: tokens aplicados em Home/Perfil/Privacidade/GeoLocalização/Check-in; CSGeoStatusCard migrado; pacote Drawer removido) |
| **E6-03** | Acessibilidade AA | **F-08** | 🟢 Implementado (S6: labels/roles/alvos 48dp nas telas + tab bar acessível) |
| **E6-04** | Loading/Empty/Error states | **F-08** | 🟢 Implementado (S6: estados com retry na Home, Perfil e Check-in; tab bar testada em smoke test de UI) |
| **E6-05** | Notificações opt-in | **F-08** | ✅ Existente — tela dedicada de opt-in no Perfil (`NotificacoesScreen`, S8), desacoplada do fluxo de feedback (E3-01) |

## Épico 7 — Painel Administrativo Web · ⏸️ ADIADO (P2)

> **Decisão D-01 (02/09/2026):** *"O Painel ADMIN ainda não é prioritário, será desenvolvido depois que o app estiver todo desenvolvido sem pendências, nem débitos técnicos."* Entra somente após o Épico 8 e as validações V-01..V-09.

| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E7-01** | Login web administrativo | **F-11** | 🔴 Inexistente |
| **E7-02** | Listar todos os hospitais (Admin) | **F-11** | 🔴 Inexistente |
| **E7-03** | Filtrar hospitais (nome/tipo/status/região) | **F-11** | 🔴 Inexistente |
| **E7-04** | Mapa com camadas georreferenciadas | **F-11** | 🔴 Inexistente |
| **E7-05** | Ir ao detalhe do hospital via mapa | **F-11** | 🔴 Inexistente |
| **E7-06** | Editar dados do hospital (Admin) | **F-11** | 🔴 Inexistente |
| **E7-07** | Desativar hospital (ícone cinza) | **F-11** | 🔴 Inexistente |
| **E7-08** | Bloqueio de escrita sobre feedback | **F-11** | 🔴 Inexistente |
| **E7-09** | Menu Hospitais/Mapa/Sugestões | **F-11** | 🔴 Inexistente |

---

## Épico 8 — Estabilização, Desempenho e Qualidade (novo em 02/09/2026)

> Estas estórias **não existiam em nenhum documento** até a v2.1 do backlog. Elas cobrem a distância entre "implementado" e "utilizável", e entre "testes escritos" e "DoD cumprido". Detalhamento e critérios de aceite: `Backlog-MVP-v2.1.md` §3, Épico 8.

| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E8-01** | Eliminar cold start na primeira abertura | Cross | 🟡 **Destino resolvido, cold start NÃO eliminado** — backend no Google Cloud Run desde 04/09/2026 (PR #79/#80, [ADR-011](08-analise%20tecnica/adrs.md)). **O sintoma continua sendo HTTP 503 na primeira abertura**, medido em 05/09/2026 no log do próprio Cloud Run: `03:37:49 · 503 · /actuator/health · 14,778 s`, seguido de `Starting new instance. Reason: AUTOSCALING`. É a mesma falha do Render (109 s em 02/09; 117,9 s e 116 s em 03/09), **7x mais curta e igualmente um erro** — o app não vê lentidão, vê requisição falhada, porque o `TIMEOUT_PADRAO_MS` de 20 s nem chega a ser atingido. Com o serviço quente: `/actuator/health` 200 em 0,18–0,21 s e `/api/v1/hospitais` 200 em 0,52 s com documento real do Atlas — **medições de instância quente, não servem para avaliar esta estória**. **Causa:** `--min-instances=0`, mantido por decisão do PO em 04/09/2026 com a orientação de "observar a necessidade de subir para 1". Esta é a observação: o gatilho ocorreu. Fechar E8-01 exige `--min-instances=1` (instância ociosa cobrada) ou aceitar o 503 na primeira abertura do dia. **Correções de registro:** (a) a mitigação por keep-alive nunca funcionou como este documento afirmou — o agendador roda o `cron` ~4x/dia, não ~96x; desligado em 04/09/2026; (b) o Cloud Run deixou de estar "descartado" — decisão de 03/09 revertida em 04/09. Oracle segue descartada (São Paulo sem capacidade Always Free, região *home* imutável). **Não fecha o E8-02:** o piso por requisição com o serviço quente precisa de medição nova sobre o Cloud Run |
| **E8-02** | Cumprir o orçamento de latência do RNF-02 | Cross | 🔴 Pendente — **P0**, medido em 1,9–4,9 s (orçamento: 300 ms p95) |
| **E8-03** | Enxugar o payload da listagem de hospitais | **F-01**, **F-07** | ✅ Entregue (02/09/2026) — o `geofence` era 73,6% do corpo (27.849 de 37.838 B). Substituído por `localizacao` + `raioMetros`; cliente reconstrói o círculo. Estimado 35,7 KB → ~11 KB (−70%), **medição pós-deploy pendente** |
| **E8-04** | Estados de carregamento/erro com timeout explícito | **F-08** | ✅ Entregue (02/09/2026) — `frontend/src/config/http.js` impõe timeout de 20 s nas 7 chamadas de rede do app (60 s na exportação LGPD, que gera PDF no servidor) e classifica a falha em **sem internet** (estado de rede lido via `expo-network`), **servidor indisponível** e **servidor demorou a responder**. 14 testes em `__tests__/config/http.test.js`; suíte do frontend em 186 testes. **Complemento OPS-05 (03/09/2026):** o timeout parou de travar a tela, mas o desfecho continuava sendo um erro. Entraram o **retry com backoff exponencial com jitter** (`fetchComRetry` — repete falha de conexão e 502/503/504; uma única repetição após timeout; nunca em 429) e a **fila offline** para o aparelho sem internet, esvaziada ao voltar ao primeiro plano e quando a conexão retorna. Fecha o pior caso da OPS-01: o check-in do geofencing dispara em segundo plano, sem tela e sem usuário — sem a fila, a visita se perdia em silêncio. Contrato ganhou o campo opcional `ocorridoEm` (check-in/checkout) para o evento reenviado registrar a hora real |
| **E8-05** | Inventário dos bugs observados em uso | Cross | 🔴 Pendente — **P0**, depende de insumo do Product Owner. O inventário já tem 3 entradas achadas por ferramenta, as duas primeiras corrigidas: **BUG-01** `SugestoesPendentesScreen` — `MapPin` não importado, `ReferenceError` ao desenhar qualquer item da fila de moderação (E1-06), severidade alta, tela inutilizável; **BUG-02** `concluirFeedback(visitaId)` — parâmetro ignorado, responder um feedback apagava a pendência de outra visita, severidade média; **BUG-03** `LoginScreen.js:132` — o controle "Esqueci minha senha" tem `accessibilityRole="button"` e `accessibilityLabel`, mas **nenhum `onPress`**: o toque não faz nada. Achado pelo `code-review` da Onda 1 (04/09/2026), severidade baixa em risco de dados e **alta em confiança**, porque promete ao usuário uma recuperação de senha que o app não tem — não existe tela nem endpoint de recuperação. **Registrado e não corrigido por decisão do PO (04/09/2026):** implementar seria feature nova, com tela, endpoint e regra de negócio, e vira estória própria no backlog. Reproduzir: abrir Login → tocar "Esqueci minha senha" → nada acontece.  **BUG-04** `GeoLocalizacaoScreen.js` — abrir o detalhe de um hospital **pela aba Mapa** congelava o app por 30–40 s (ANR). Relatado pelo PO em uso real (03/09/2026, 22:33) e reproduzido em 04/09; **8 ANRs** no `dropbox` do aparelho entre 02/09 e 04/09, todos bloqueando na mesma chamada. Causa: o toque confirmado que o Android entrega ~215 ms depois do gesto caía em `queryRenderedFeatures`, uma JNI **síncrona**, sobre um MapLibre cuja thread de renderização a navegação já havia encerrado — `pthread_cond_wait` sem timeout. Severidade **alta**: app inutilizável até ser morto à força. **Corrigido em 04/09/2026** — o `<Map>` passa a ser **desmontado antes** de navegar (`onDestroy()` marca `NativeMapView.destroyed` e a mesma chamada retorna vazia), e remontado no evento `focus`. **Validado no aparelho**: 4 aberturas seguidas, todas abaixo de 2 s, zero ANRs novos. **Limitação conhecida:** a correção cobre a saída pelo toque no polígono; sair pela barra de abas ou pelo botão voltar dentro da janela de ~215 ms após um toque no mapa pode reproduzir a mesma corrida — desmontar no `blur` não resolve (o `blur` dispara durante a navegação, depois do teardown) e fica como estória própria. **BUG-05** `GeoLocalizacaoScreen.js` — na aba Mapa, **arrastar o mapa fazia os rótulos dos hospitais saírem da área do mapa**, desenhados por cima do cabeçalho e da caixa de informações e cobrindo os chips do filtro de raio (F-07), que ficavam ilegíveis e sem alvo visível. Relatado pelo PO com captura de tela (05/09/2026). Reproduzir: abrir a aba Mapa → arrastar até um hospital sair da área visível. Causa, lida no código da `@maplibre/maplibre-react-native@11.3.6`: cada marcador é uma View Android comum, filha direta da `MapView`, posicionada por coordenada absoluta em `MarkerViewManager.updateMarkerPosition` (`view.x = screenPos.x - ...`, linhas 74-75) — coordenada que fica **negativa** assim que o ponto sai da viewport —, e o `addMarker` (linhas 40-42) **desliga o recorte** que conteria o desenho (`mapView.clipChildren = false`, `clipToPadding = false`, `clipToOutline = false`). Sem nenhum ancestral recortando, o desenho escapa para a tela inteira. Severidade **média**: nada trava nem corrompe dado, mas o filtro fica inutilizável na prática. **Corrigido em 05/09/2026** — o `<Map>` passa a viver dentro de um container com `overflow: "hidden"`, o mesmo arranjo que o `HospitalDetalheScreen` já usava (`mapContainer`); no RN 0.83, `ReactViewGroup.dispatchDraw` chama `clipToPaddingBox` quando `overflow != VISIBLE`, e o recorte do canvas é herdado por toda a subárvore — nenhum descendente o desfaz. **Evidência:** 2 testes novos, os dois mortos por mutação (retirar o `overflow` mata um; tirar o mapa de dentro do container mata o outro); suíte cheia em 34 suítes / 293 testes, cobertura 80,01/68,39/78,10/80,50. **Pendente de validação no aparelho:** a correção é de recorte nativo e ainda não foi vista rodando no S24 Ultra. Falta o que só o PO tem: os defeitos vistos em uso real, com passo de reprodução, evidência e severidade |
| **E8-06** | Métricas de latência e erro por endpoint | Cross | 🔴 Pendente |
| **E8-07** | Crash reporting no app | Cross | 🔴 Pendente |
| **E8-08** | Medição de cobertura de testes (DoD ≥ 70%) | Cross | 🟡 Parcial (02/09/2026) — cobertura medida e com piso na esteira: JaCoCo no backend (**67,49%** de instruções, **51,78%** de *branches*, piso 65%/50%) e `coverageThreshold` no Jest (piso inicial 70%/58%). Relatórios publicados como artefato do CI. **Régua redefinida pelo PO em 04/09/2026: 90% em todo o frontend**, nas quatro métricas — e testes que exercitem comportamento real, não testes escritos para subir o número. **Onda 1 (componentes) entregue em 04/09/2026:** `LoginScreen` 0% → 100% e `CSTextField` 66,66% → 100% (linha de base medida em `develop`); os **11 componentes** da pasta em 100% de *statements*/*functions*/*lines* — porém **não em *branches*** (a pasta `components` está em 76,19% e só o `CSTextField` passa de 90). Pela régua das quatro métricas, os componentes voltam para a fila das ondas seguintes. O `components/index.js` **não é lacuna de cobertura**: é módulo só de reexportação, o Istanbul instrumenta zero statements nele (`total: 0` nas quatro métricas, `pct: 100` no `coverage-summary.json`) e o `0 | 0 | 0 | 0` da tabela do Jest é a renderização de "nada a medir". Nenhuma onda futura pode elevá-lo — e o barril **é** importado por 7 telas de produção cujos testes rodam. Global do frontend **após o merge da OPS-05 (#75)**: **79,71%** de *statements*, **67,72%** de *branches*, **77,67%** de *functions*, **80,22%** de *lines* (286 testes em 34 suítes); a Onda 1 isolada fechou em 78,81/66,94/76,96/79,40 com 248 testes em 31 suítes. Piso do Jest subiu junto: 78/66/76/79 na Onda 1 e **79/67/77/80** depois do merge da OPS-05 (#75), por decisão do PO — ganho que não vira piso não está protegido. A folga mais apertada é *lines*, com 0,28pp (~5 linhas). Ondas seguintes, por risco: `GeofencingTaskService` (17,6%/6,9% — o check-in automático), telas zeradas (`SugerirHospital` 2,8%, `RevisarSugestao` 3,0%, `UserScreen` 3,2%, `Privacidade` 16,6%), telas medianas, serviços e `App.js` (0% de *branches*). Backend segue em 67,49% |
| **E8-09** | Contrato OpenAPI publicado | **F-09** | 🔴 Pendente |
| **E8-10** | Testes de integração com contexto Spring | Cross | 🔴 Pendente |
| **E8-11** | Analytics de produto (funil, retenção) | Cross | 🔴 Pendente |
| **E8-12** | CI rodando `npm test` no frontend | Cross | ✅ Entregue — step `Testes (Jest)` no job de frontend do `ci.yml` (`npm test -- --ci --maxWorkers=2`), **171 testes** em ~20 s. `develop` recebeu proteção de branch com os checks `Backend (Spring Boot)` e `Frontend (Expo Web)` obrigatórios. ⚠️ **Correção de 03/09/2026: essa proteção NÃO existe mais.** Verificado pela API: `develop` e `master` estão ambas **sem proteção e sem ruleset**. A causa provável é o repositório ter sido tornado privado por alguns minutos em 03/09 — proteção de branch não está disponível em repositório privado no plano Free, e voltar a público **não a restaura**. Sumiu em silêncio, e este documento seguiu afirmando que existia. Os rulesets para reimportar ficam versionados em [`.github/rulesets/`](../.github/rulesets/) — ver **P-007** |
| **E8-13** | Lint no frontend (o `typecheck` atual não verifica nada) | Cross | ✅ Entregue (02/09/2026) — ESLint 9 + `eslint-config-expo` com `eslint.config.js` comentado regra a regra; `npm run lint` roda no `ci.yml` depois do typecheck e reprova o PR por erro **ou** por aviso acima do piso congelado (18), mesma lógica do piso de cobertura. **Encontrou defeito de produção na primeira execução:** `SugestoesPendentesScreen` importava `MapPinOff` e renderizava `<MapPin />` — `ReferenceError` ao desenhar qualquer item da fila de moderação (E1-06). A tela era uma das 7 sem teste (ENG-05); ganhou 4 testes, sendo o primeiro a regressão do defeito. Segundo achado: `concluirFeedback(visitaId)` recebia o id e o ignorava, apagando a pendência guardada fosse ela de qual visita fosse. Também foram removidos 8 imports mortos. Sobram 18 avisos das regras da geração React Compiler (`refs`, `set-state-in-effect`, `purity`), catalogados como dívida ARQ-03 |
| **E8-14** | Encerrar divergências de contrato (`password`/`senha`, `users`/`usuarios`) | **F-02** | 🔴 Pendente — abertas desde 20/08/2026 |
| **E8-15** | Retenção de dados (LGPD art. 16) e teste de restauração de backup | **F-09** | 🔴 Pendente |

---

## Legenda

| Marcador | Significado |
|---|---|
| ✅ Existente | Implementado em `develop`, com teste automatizado, referenciado por PR |
| 🟡 Parcial | Implementado com desvio conhecido em relação ao critério de aceite |
| 🔴 Pendente | Não implementado |
| ⏸️ Adiado | Escopo válido, retirado do caminho crítico por decisão de priorização |

> **Regra de manutenção (D-03):** o PR que entrega uma estória **atualiza a linha dela nesta tabela, no mesmo PR**. Este arquivo é a fonte de verdade sobre status de estória; qualquer divergência em relação a outro documento resolve-se a favor dele, desde que apoiada em código na `develop`.
