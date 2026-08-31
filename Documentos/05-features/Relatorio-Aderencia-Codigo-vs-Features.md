# 🔍 Relatório de Aderência — Features × Código Real (v3.4)

> **Verificação do que existe implementado vs. o que as Features propõem**
>
> Data: Atualizada — v3.4 (31/08/2026; decisões de contrato executadas — cadastro, namespace `contas`, E5-03 backend)
> Alterações desta versão: A **v3.4** registra a execução das decisões de contrato abertas na v3.3: (1) cadastro migrado de `/api/user/cadastro` para **`POST /api/v1/auth/registro`** com **consentimento LGPD obrigatório** no request; (2) **`GET /api/v1/usuarios/me` removido** do contrato (perfil segue no payload do login); e (3) o namespace **`me/`** foi substituído por **`/api/v1/contas`** (responsabilidade lógica do titular). Também implementa o **backend de E5-03** (histórico paginado de visitas/feedbacks + **exportação LGPD art. 18** em `GET /api/v1/contas/export`), que passou de "fora do escopo" para **parcialmente coberto** (UI do histórico segue na Sprint S8). As v3.2/v3.3 registraram, respectivamente, as 3 correções de estória (RN-07, RN-10/11, E3-03) e o logout server-side (F0-02).

---

## 1. Resumo Executivo

| Categoria | Quantidade no escopo S0–S6 | % das Features |
|---|---|---|
| ✅ Existente (funcional) | 9/9 | 100% |
| 🟡 Parcial (desvio de detalhe em estória RN) | 0/9 (3 estórias corrigidas: E2-08, E3-02, E3-03) | — |
| 🔴 Inexistente (precisa construir) | 0/9 | 0% |

> **Escopo:** MVP Sprints **S0–S6** + backend de E5-03 (implementado na v3.4) e **UI do histórico** `HistoricoScreen` (E5-03, 31/08/2026). Fora do escopo do MVP e **não contam como parciais/inexistentes**: UI de exportação (E5-03), E4-05 UI, F-07 mapa, E5-05 revogação nativa, E6-05 opt-in de notificações — Sprint S8 — e Épico 7/Painel (F-11).

**Conclusão:** No escopo S0–S6, a `develop` está **100% coberta** nas 9 Features com **0 desvios RN pendentes**: autenticação JWT/BCrypt, rate limiting (F0-04), exclusão de conta LGPD com anonimização (F0-05), CRUD/geofence de Hospitais, sugestões + moderação (backend), Visitas com detecção automática via geofencing nativo + heartbeat, Feedback pós-saída com dedupe e anônimo, agregações estatísticas (Indicadores Públicos por Hospital, atualização ≤ 15min) + ranking (backend), frontend de Conta/Privacidade (E5-01/02/04) e UX (Bottom Tabs, Design System v2.0, a11y AA — E6-01..04). Os **3 desvios de estória** apontados na v3.1 foram **corrigidos** no PR `bugfix/ajustes-rn-feedback-estatisticas` (RN-07, RN-10/11 e E3-03). Na v3.3, o **logout com blacklist de refresh** (F0-02) foi implementado. Na **v3.4**, as decisões de contrato foram **executadas**: cadastro migrado para `/api/v1/auth/registro` com consentimento LGPD, `GET /usuarios/me` removido e o namespace `me/` renomeado para **`/api/v1/contas`** — **zero decisões de contrato pendentes**.

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
| `AuthController.java` | ✅ Existe | Login/refresh + `POST /api/v1/auth/logout` (revoga refresh na blacklist, F0-02) |
| `AuthDocument.java` | ✅ Existe | Mongo document OK |
| `AuthServiceImpl.java` | ✅ **Seguro** | Compara senha via `passwordEncoder.matches`; refresh rotaciona e revoga o anterior; logout idempotente |
| `AuthRepository.java` | ✅ Existe | `findByEmail` |
| `UserController.java` | ❌ Removido (v3.4) | Legado `POST /api/user/cadastro` migrado para `POST /api/v1/auth/registro` (`AuthController` §3.1) |
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
| Ignorar visitas < 2min | ✅ `DURACAO_MINIMA_MINUTOS=2` na agregação (RN-07 — corrigido no PR do bugfix) |

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
| Formulário < 45s com 4 perguntas | ✅ (E3-02 — RN-10/11 corrigidos no PR do bugfix: select searchable de especialidade, ramificação triagem=Sim→Tela 2, "Não interagi" zera `tratamentoEquipe`, opção `DESISTI` removida, motivo obrigatório quando não atendido) |
| Janela de 24h + 1 lembrete único | ✅ (E3-03 — lembrete único em ~6h após a 1ª notificação, janela 24h/RN-09) |
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

> **Escopo desta auditoria (31/08/2026): MVP — Sprints S0–S6** + backend de E5-03 (v3.4). Itens da **Sprint S8** (UI do histórico E5-03, E4-05 UI, F-07 mapa, E5-05 revogação via API, E6-05 opt-in de notificações) e do **Épico 7 / Painel Administrativo Web (F-11)** são **fora do escopo do MVP** e não são contabilizados como pendência.

1. **No escopo S0–S6, a `develop` está concluída e validada**: autenticação JWT/BCrypt, rate limiting (F0-04), exclusão de conta LGPD (`DELETE /api/v1/contas/exclusao`, F0-05), CRUD/geofence de hospitais + sugestões e moderação (backend), visitas com geofencing nativo + heartbeat, feedback pós-saída (backend + mobile), indicadores públicos por hospital + ranking (backend) e o frontend de Conta/Privacidade (E5-01/02/04) e de UX (E6-01..04).
2. **Correções aplicadas (PR `bugfix/ajustes-rn-feedback-estatisticas`)** — os 3 desvios de estória da v3.1 foram implementados e testados:
   - **RN-07 / E2-08:** filtro **< 2min na agregação** (`DURACAO_MINIMA_MINUTOS=2` no `AgregadoServiceImpl`) + teste;
   - **E3-02 / RN-10-11:** select searchable de especialidade, ramificação "triagem=Não → pula especialidade", "Não interagi" em `tratamentoEquipe`, remoção da opção `DESISTI` e motivo obrigatório quando não foi atendido (`FeedbackFormScreen`) + testes FE;
   - **E3-03 / RN-09:** lembrete único em **~6h** após a 1ª notificação (`FeedbackNotificationService`).
   Validação FE: 16 suítes/99 testes ✓ + `tsc --noEmit` ✓. (Testes unit do backend dependem de JDK 25/Docker — rodam no CI.)
3. **Decisões de contrato executadas (PR `contas - registro e contas`, 31/08/2026)** — encerra as pendências da v3.3:
   - **Cadastro:** `POST /api/user/cadastro` (legado) → **`POST /api/v1/auth/registro`**, com `consentimento` LGPD obrigatório (`termosUso: true`), validado em `UserServiceImpl.saveUser` (400 quando ausente). `UserController` removido.
   - **`GET /api/v1/usuarios/me`:** removido do contrato (perfil no payload do login).
   - **Namespace `me/` → `/api/v1/contas`:** `GET /api/v1/contas/visitas` (histórico), `GET /api/v1/contas/feedbacks`, `GET /api/v1/contas/export` (LGPD art. 18), `DELETE /api/v1/contas/exclusao`. App mobile atualizado (`UserService.registro`, `VisitaService.listarHistorico`, testes).
    - **E5-03 backend + UI implementados:** histórico paginado de visitas e de feedbacks + exportação de dados do titular; **UI** `HistoricoScreen` criada na aba Perfil (visitas com nome do hospital anexado pelo backend + avaliações, RN-22) com acesso por "Meu histórico" e navegação pós-login para Perfil. Fica como S8 apenas o `PUT /api/v1/contas/consentimentos` (E5-05).
4. **Fora do escopo do MVP** (não são pendências desta auditoria): UI de exportação LGPD, UI do ranking, mapa com geofences, revogação de consentimentos via API, opt-in dedicado de notificações (**Sprint S8**) e o **Painel Admin Web** (Épico 7/F-11, cujo fluxo de moderação de sugestões absorve as telas mobile de F-10).
