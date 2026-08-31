# 🔍 Relatório de Aderência — Features × Código Real (v3.1)

> **Verificação do que existe implementado vs. o que as Features propõem**
>
> Data: Atualizada — v3.1 (última auditoria: 30/08/2026)
> Alterações desta versão: Reflete a auditoria completa da `develop` em 30/08/2026 — confirma Fase 0 (JWT/BCrypt/rate limiting/exclusão LGPD), Épicos 1–6 (Sprint S6 concluída), ranking (backend), formaliza a Sprint S8 e corrige o endpoint de exclusão de conta (`DELETE /api/v1/contas/exclusao`, PR #25) e o estado F-08/E6.

---

## 1. Resumo Executivo

| Categoria | Quantidade no escopo S0–S6 | % das Features |
|---|---|---|
| ✅ Existente (funcional) | 9/9 | 100% |
| 🟡 Parcial (desvio de detalhe em estória RN) | 0 features 🟡 (3 estórias: E2-08, E3-02, E3-03) | — |
| 🔴 Inexistente (precisa construir) | 0/9 | 0% |

> **Escopo:** MVP Sprints **S0–S6**. Itens da Sprint S8 (E4-05 UI, F-07 mapa, E5-03, E5-05, E6-05) e Épico 7/Painel (F-11) são fora do escopo do MVP e **não contam como parciais/inexistentes**.

**Conclusão:** No escopo S0–S6, a `develop` está **100% coberta** nas 9 Features: autenticação JWT/BCrypt, rate limiting (F0-04), exclusão de conta LGPD com anonimização (F0-05), CRUD/geofence de Hospitais, sugestões + moderação (backend), Visitas com detecção automática via geofencing nativo + heartbeat, Feedback pós-saída com dedupe e anônimo, agregações estatísticas (Indicadores Públicos por Hospital, atualização ≤ 15min) + ranking (backend), frontend de Conta/Privacidade (E5-01/02/04) e UX (Bottom Tabs, Design System v2.0, a11y AA — E6-01..04). Permanecem apenas **3 desvios de detalhe em estórias (RN)**, sem comprometer a Feature: RN-07 (filtro <2min na agregação), E3-02 (select CNES/DATASUS, ramificação por triagem, "Não interagi") e E3-03 (lembrete +1h vs ~6h).

---

## 2. Aderência Detalhada (Feature × Código)

### ✅ F-01 — Cadastro e Gestão de Hospitais
**Status: FUNCIONAL — O backend atende plenamente**

| O que a feature precisa | O que existe |
|---|---|
| `HospitalDocument.java` (MongoDB) | ✅ (Possui Location Point / GeoJSON Polygon) |
| `HospitalController.java` (CRUD REST) | ✅ |
| `HospitalService.java` | ✅ (Lista os 340 hospitais já importados) |
| Índice 2dsphere no MongoDB | ✅ |
| Tela de cadastro de hospital com mapa | 🔴 (Não focaremos, gestão será primariamente API/Admin) |
| Tela de listagem de hospitais no app | ✅ (Lista de hospitais com indicadores no app — Épico 4) |
| Endpoint `POST/GET/PUT /api/v1/hospitais` | ✅ |

---

### ✅ F-02 — Autenticação e Conta do Usuário
**Status: FUNCIONAL — Autenticação Backend 100% (JWT + BCrypt)**

| Arquivo existente | Status | Comentário |
|---|---|---|
| `AuthController.java` | ✅ Existe | Login validando Hash e gerando tokens |
| `AuthDocument.java` | ✅ Existe | Mongo document OK |
| `AuthServiceImpl.java` | ✅ **Seguro** | Compara senha via `passwordEncoder.matches` |
| `AuthRepository.java` | ✅ Existe | `findByEmail` |
| `UserController.java` | ✅ Existe | `POST /api/user/cadastro` |
| `UserDocument.java` | ✅ Existe | Mongo document OK |
| `UserServiceImpl.java` | ✅ **Seguro** | Salva o usuário codificando a senha via `passwordEncoder.encode()` |
| `LoginRequest/Response.java` | ✅ Existe | DTOs OK |
| `LoginScreen.js` | ✅ Existe | Consome o serviço JWT; design system v2.0 (S6/PR #29), selo LGPD |
| `LoginService.js` | ✅ Existe | Lê os tokens (`accessToken` e `refreshToken`) da resposta da API |

---

### ✅ F-03 — Detecção Automática de Entrada/Saída
**Status: FUNCIONAL (Épico 2)**

| O que a feature precisa | O que existe |
|---|---|
| Geofencing nativo (`startGeofencingAsync` + `expo-task-manager`) | ✅ Frontend com geofencing nativo + heartbeat periódico |
| Módulo `visita` no backend (checkin/checkout) | ✅ `VisitaDocument`, `VisitaController` (checkin/checkout/heartbeat) |
| Evento de entrada/saída do geofence nativo → API | ✅ Detecção automática de entrada/saída |
| Expiração de visita > 24h (job) | ✅ `EXPIRADA` (E2-03) |
| Conflito de geofences sobrepostos | ✅ Hospital mais próximo (E2-04) |
| Recuperação de GPS interrompido | ✅ Timeout 10min (E2-05) |
| Prompt de internação/observação | ✅ Após 12h (E2-10) |
| Ignorar visitas < 2min | 🟡 Parcial (RN-07): entrada automática exige ≥ 2min (E2-01/02) e barra curtas, mas não há filtro explícito **< 2min na agregação** — decidir implementar |

---

### ✅ F-04 — Visita Ativa e Cronômetro
**Status: FUNCIONAL (Épico 2)**

| O que a feature precisa | O que existe |
|---|---|
| `VisitaDocument.java` (MongoDB) — entrada, saída, duração, status | ✅ |
| `VisitaController.java` — endpoints checkin/checkout/heartbeat | ✅ |
| Card de visita ativa na Home | ✅ Card com cronômetro (E2-07) |
| Check-in manual em 1 toque | ✅ Fallback GPS desligado (E2-06) |

---

### ✅ F-05 — Feedback Pós-Saída
**Status: FUNCIONAL (Épico 3)**

| O que a feature precisa | O que existe |
|---|---|
| Notificação local 1–5min após saída | ✅ (E3-01) |
| Formulário < 45s com 4 perguntas | 🟡 Parcial (RN-10/11): fluxo de 4 telas + Pular implementado, mas a especialidade é texto livre (doc: select CNES/DATASUS), a ramificação por triagem não é feita e `tratamentoEquipe` usa estrelas 1–5 sem a opção "Não interagi" |
| Janela de 24h + 1 lembrete único | ✅ (E3-03) |
| Bloquear feedback duplicado (unique `visitaId`) | ✅ (E3-04) |
| Feedback anônimo (`usuarioId` nulo) | ✅ (E3-05) |
| Tela de agradecimento e impacto | ✅ (E3-06) |

---

### ✅ F-06 — Indicadores Públicos por Hospital
**Status: FUNCIONAL (Épico 4)**

| O que a feature precisa | O que existe |
|---|---|
| Nota média do hospital | ✅ Agregado `agregados_hospitais` + média 90 dias (RN-14) |
| Tempo médio/mediano | ✅ Mediana do tempo de espera (RN-16/RN-24) |
| Detalhe público do hospital | ✅ `GET /api/v1/hospitais/{id}/indicadores` + tela dedicada |
| Atualização dos agregados a cada 15min | ✅ Job `@Scheduled` + evento `FeedbackSalvoEvent` (E4-04) |
| Transparência (exibir só N≥5) | ✅ RN-15 |
| Ranking de hospitais (E4-05) | ✅ `GET /api/v1/hospitais/ranking` (NOTA/TEMPO + filtro tipo + paginação, PR #27) — todo o backend no escopo S0–S6 · UI de ordenação é **Sprint S8 (fora do escopo)** |

---

### 🟡 F-07 — Mapa e Busca de Hospitais
**Status: FORA DO ESCOPO S0–S6 — `react-native-maps` presente; integração de geofences/hospitais e filtro geo é **Sprint S8** (F-06 da S8). Não conta como pendência desta auditoria.**

| Fora do escopo (S8) |
|---|
| `GET /api/v1/hospitais` consumido pelo front com filtro geo (raio) |
| Marcadores dos polígonos dos hospitais renderizados no `react-native-maps` |

---

### 🟡 F-08 — Polimento e Acessibilidade
**Status: FUNCIONAL no escopo S0–S6 — Sprint S6 concluída (E6-01..04, PR #29); único item fora do escopo é E6-05 (opt-in dedicado) → Sprint S8**

| O que existe (no escopo) |
|---|
| Bottom Tabs (Início/Hospitais/Perfil) substituindo o Drawer (E6-01) |
| Design System v2.0 — tokens (cores/raios/sombras) em 100% das telas + componentes `CS*` (E6-02); assets legados GIF/PNG removidos |
| Acessibilidade AA + estados loading/erro/empty (E6-03/E6-04) |
| **Fora do escopo:** E6-05 (opt-in de notificações desacoplado do fluxo E3) — Sprint S8 |

---

### ✅ F-09 — Segurança e Privacidade
**Status: FUNCIONAL — Backend Responde adequadamente**

| Vulnerabilidade | Localização / Resposta |
|---|---|
| **Senha em texto puro** | ❌ (Corrigido/Inexistente - App utiliza BCrypt e JWT) |
| **Exclusão de Conta / LGPD** | ✅ `DELETE /api/v1/contas/exclusao` (autenticada) — cascade remove user + `auth_logins`, anonimiza visitas/feedbacks e recalcula agregados (F0-05, PR #25) |
| **Erros da API (Envelope)** | ✅ Padronizado (Retorna timestamp, traceId, message) |

---

## 3. Recomendações Atualizadas

> **Escopo desta auditoria (30/08/2026): MVP — Sprints S0–S6.** Itens da **Sprint S8** (E4-05 UI, F-07 mapa, E5-03 histórico/exportação, E5-05 revogação nativa, E6-05 opt-in de notificações) e do **Épico 7 / Painel Administrativo Web (F-11)** são **fora do escopo do MVP** e não são contabilizados como pendência.

1. **No escopo S0–S6, a `develop` está concluída e validada**: autenticação JWT/BCrypt, rate limiting (F0-04), exclusão de conta LGPD (`DELETE /api/v1/contas/exclusao`, F0-05), CRUD/geofence de hospitais + sugestões e moderação (backend), visitas com geofencing nativo + heartbeat, feedback pós-saída (backend + mobile), indicadores públicos por hospital + ranking (backend) e o frontend de Conta/Privacidade (E5-01/02/04) e de UX (E6-01..04).
2. **Pendências reais dentro do escopo S0–S6** (a tratar no código — desvios de implementação):
   - **RN-07 / E2-08:** filtro de visitas < 2min **não implementado na agregação** (`AgregadoServiceImpl`);
   - **E3-02 / RN-10-11:** detalhes do formulário — especialidade como select CNES/DATASUS, ramificação "triagem=Não → pula especialidade" e opção "Não interagi" em `tratamentoEquipe`;
   - **E3-03 / RN-09:** lembrete de feedback em **+1h** vs doc **~6h**.
3. **Decisões de contrato pendentes (spec §3.1 vs código — funcional, precisa alinhar doc ou código)**: endpoint de cadastro (`/api/user/cadastro` legado vs `/api/v1/auth/registro`), **logout/blacklist de refresh** (teste previsto na Sprint S0 e não implementado) e **`GET /api/v1/usuarios/me`** (perfil servido no payload do login).
4. **Fora do escopo do MVP** (não são pendências desta auditoria): UI do ranking, mapa com geofences, histórico/exportação, revogação nativa completa, opt-in dedicado de notificações (**Sprint S8**) e o **Painel Admin Web** (Épico 7/F-11, cujo fluxo de moderação de sugestões absorve as telas mobile de F-10).
