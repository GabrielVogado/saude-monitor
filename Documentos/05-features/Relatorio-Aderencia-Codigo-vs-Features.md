# 🔍 Relatório de Aderência — Features × Código Real

> **Verificação do que existe implementado vs. o que as Features propõem**
>
> Data: 08/08/2026 · Base: varredura de 19 arquivos backend + 12 arquivos frontend

---

## 1. Resumo Executivo

| Categoria | Quantidade | % das Features |
|---|---|---|
| ✅ Existente (funcional) | 1/9 | 11% |
| 🟡 Parcial (precisa refatoração) | 3/9 | 33% |
| 🔴 Inexistente (precisa construir) | 5/9 | 56% |

**Conclusão:** o código atual cobre apenas autenticação/cadastro (de forma insegura) e um esboço de mapa com GPS contínuo. **5 das 9 features do MVP não têm uma única linha de código** — todo o núcleo do produto (hospitais, geofence, visitas, feedback, indicadores) está por construir.

---

## 2. Aderência Detalhada (Feature × Código)

### 🔴 F-01 — Cadastro e Gestão de Hospitais
**Status: INEXISTENTE — 0 arquivos backend, 0 arquivos frontend**

| O que a feature precisa | O que existe |
|---|---|
| `HospitalDocument.java` (MongoDB) | ❌ |
| `HospitalController.java` (CRUD REST) | ❌ |
| `HospitalService.java` | ❌ |
| Índice 2dsphere no MongoDB | ❌ |
| Tela de cadastro de hospital com mapa para desenhar polígono | ❌ |
| Tela de listagem de hospitais no app | ❌ |
| Endpoint `POST/GET/PUT /api/v1/hospitais` | ❌ |

**Esforço estimado:** 16 pts (tudo do zero, tanto BE quanto FE)

---

### 🟡 F-02 — Autenticação e Conta do Usuário
**Status: PARCIAL — 7 arquivos backend, 4 arquivos frontend · ⚠️ Crítico de segurança**

| Arquivo existente | Status | Problema |
|---|---|---|
| `AuthController.java` | ✅ Existe | Só tem `POST /api/auth/login` |
| `AuthDocument.java` | ✅ Existe | Mongo document OK |
| `AuthServiceImpl.java` | ⚠️ **Crítico** | **Senha salva em texto puro** — `document.setPassword(request.password())` sem hash |
| `AuthRepository.java` | ✅ Existe | `findByEmail` |
| `UserController.java` | ✅ Existe | `POST /api/user/cadastro` |
| `UserDocument.java` | ✅ Existe | Mongo document OK |
| `UserServiceImpl.java` | ✅ Existe | Cadastro funcional, normaliza email |
| `LoginRequest/Response.java` | ✅ Existe | DTOs OK |
| `LoginScreen.js` | ⚠️ Parcial | Funciona, mas usa assets antigos (.gif, .png) |
| `LoginService.js` | ⚠️ Parcial | Só chama `/api/auth/login`, sem JWT |
| `UserScreen.js` | ✅ Existe | Cadastro funcional, já segue novo design |
| `UserService.js` | ✅ Existe | Chama `/api/user/cadastro` |

| O que falta | Prioridade |
|---|---|
| Hash de senha com BCrypt (substituir `setPassword()`) | 🔥 P0 |
| Emissão de JWT (access + refresh) | 🔥 P0 |
| Armazenamento seguro do token no app (SecureStore) | 🔥 P0 |
| Endpoint `/api/v1/auth/refresh` | P0 |
| Endpoint `/api/v1/auth/logout` | P0 |
| Tela de perfil (dados, consentimentos, exclusão LGPD) | P0 |
| Rate limiting em login | P1 |

**Esforço estimado: 18 pts (Fase 0 — reescrever auth, corrigir segurança, adicionar JWT)**

---

### 🔴 F-03 — Detecção Automática de Entrada/Saída
**Status: INEXISTENTE — 0 arquivos backend para visita · frontend só tem GPS contínuo**

| Arquivo existente | Status |
|---|---|
| `GeoLocalizacaoScreen.js` + `GeoLocalizacaoService.js` | ⚠️ Existe, **mas é o oposto do que precisamos** — usa `watchPositionAsync` com `BestForNavigation` a cada 2s (GPS ligado o tempo todo, drena bateria) |
| `react-native-maps` (dependência) | ✅ Já instalada |
| `expo-location` (dependência) | ✅ Já instalada |

| O que falta |
|---|
| Substituir `watchPositionAsync` por `startGeofencingAsync` + `expo-task-manager` (ADR-002) |
| Módulo `visita` no backend (checkin/checkout) |
| Validação geoespacial no backend (`$geoIntersects` no MongoDB) |
| Índice 2dsphere na coleção `hospitais` |
| Evento de entrada/saída do geofence nativo → API |

**Esforço estimado: 19 pts (reescrever geolocalização, criar módulo visitas, testar em campo)**

---

### 🔴 F-04 — Visita Ativa e Cronômetro
**Status: INEXISTENTE — 0 arquivos backend, 0 arquivos frontend**

| O que falta |
|---|
| `VisitaDocument.java` (MongoDB) — entrada, saída, duração, status, tipoPermanencia, ultimoHeartbeat |
| `VisitaController.java` — endpoints checkin/checkout/heartbeat/expirar/tipo-permanencia |
| `VisitaService.java` — lógica RN-01..RN-07, RN-23, RN-24 |
| Card de visita ativa na Home (cronômetro, nome do hospital) |
| Heartbeat a cada 30min (E2-09) |
| Prompt de internação/observação aos 12h (E2-10) |
| Job de expiração (24h sem heartbeat) |

**Esforço estimado: 21 pts**

---

### 🔴 F-05 — Feedback Pós-Saída
**Status: INEXISTENTE — 0 arquivos backend, 0 arquivos frontend · ⚠️ Depende de F-03 e F-04**

| O que falta |
|---|
| `FeedbackDocument.java` (MongoDB) — visitaId, perguntas, nota, comentário |
| `FeedbackController.java` — endpoint de envio (anônimo ou logado) |
| `FeedbackService.java` — validação, dedupe (RN-12) |
| Notificação local pós-saída (`expo-notifications`) |
| Tela de formulário de feedback (4 perguntas, progresso, estrelas, chips, pular) |
| Tela de agradecimento pós-envio |
| Lembrete único (RN-09) |

**Esforço estimado: 16 pts**

---

### 🔴 F-06 — Indicadores Públicos por Hospital
**Status: INEXISTENTE — 0 arquivos · ⚠️ Depende de F-03, F-04, F-05**

| O que falta |
|---|
| `AgregadoHospitalDocument.java` (materialized view) |
| Job de agregação (recalcula a cada feedback ou batch) |
| Endpoint `GET /api/v1/hospitais/{id}/indicadores` |
| Endpoint `GET /api/v1/hospitais/ranking` |
| Tela de detalhe público do hospital (nota, tempo médio, N, período) |
| Tela de ranking/lista de hospitais |

**Esforço estimado: 20 pts**

---

### 🟡 F-07 — Mapa e Busca de Hospitais
**Status: PARCIAL — frontend tem mapa com posição do usuário, mas sem hospitais**

| Arquivo existente | O que faz | O que falta |
|---|---|---|
| `GeoLocalizacaoScreen.js` | MapView + Marker da posição do usuário | Renderizar polígonos de geofence dos hospitais |
| `GeoLocalizacaoService.js` | Contexto de GPS com watchPositionAsync | Substituir por geofencing (F-03) |
| `app.json` | Permissões `ACCESS_FINE_LOCATION` | — |

| O que falta |
|---|
| `GET /api/v1/hospitais` com filtro geo (raio) — backend F-01 |
| Marcadores dos hospitais no mapa |
| Busca por nome/tipo |
| Lista de hospitais próximos |

**Esforço estimado: 8 pts (componentes de UI sobre F-01 já construído)**

---

### 🟡 F-08 — Polimento e Acessibilidade
**Status: PARCIAL — inconsistência visual entre telas**

| Problema específico | Impacto |
|---|---|
| `LoginScreen.js` usa `doutor.gif` + ícones PNG — **não segue o Design System v2.0** | Identidade visual quebrada entre Login e Cadastro |
| `UserScreen.js` já usa `lucide-react-native` + tokens do Clinical Sanctuary | ✅ Bom — serve como referência |
| `HomeScreen.js` já usa conteúdo alinhado à proposta (monitoramento hospitalar) | ✅ Bom |
| Sem Bottom Tabs (ainda usa Drawer) | Navegação de gestor, não de paciente |
| Sem estados de loading/empty/error padronizados | UX inconsistente |
| Sem verificação WCAG (leitores de tela, contraste) | Barreira de acessibilidade |
| Selos "HIPAA Compliant" no LoginScreen | Errado para mercado brasileiro (LGPD) |

| O que falta |
|---|
| Unificar todas as telas no Design System v2.0 (cores, tipografia, ícones, componentes) |
| Migrar Drawer → Bottom Tabs |
| Criar componentes padronizados: LoadingState, EmptyState, ErrorState |
| Remover assets antigos (GIF, ícones PNG) |
| Substituir "HIPAA" por "LGPD" |
| Verificar e corrigir contraste WCAG AA, alvos ≥ 48dp, roles de acessibilidade |

**Esforço estimado: 20 pts (refatoração visual + acessibilidade + componentes compartilhados)**

---

### 🔴 F-09 — Segurança e Privacidade
**Status: NÃO CONFORME — problemas críticos bloqueiam qualquer deploy**

| Vulnerabilidade | Gravidade | Localização |
|---|---|---|
| **Senha em texto puro** (sem hash) | 🔴 Crítica | `AuthServiceImpl.java:28` — `document.setPassword(request.password())` |
| Sem autenticação real (login só grava documento) | 🔴 Crítica | `AuthController.java` — não emite token |
| Sem HTTPS (dev) | 🟡 Média | Dev apenas — OK, mas produção exige |
| Sem rate limiting | 🟡 Média | Endpoints de login expostos a brute-force |
| Sem consentimento LGPD granular | 🟡 Média | Permissão de localização existe, mas sem onboarding/revogação |
| Sem endpoint de exclusão de conta (LGPD) | 🟡 Média | Direito do titular não implementado |
| Selos "HIPAA" (padrão americano, não brasileiro) | 🟢 Baixa | `LoginScreen.js` — cosmético, mas confunde |

**Esforço estimado: 18 pts (Fase 0 — corrigir tudo antes de expor qualquer endpoint)**

---

## 3. Comparação: Esforço documentado vs. Realidade

| Feature | Pontos estimados (Scrum Master) | Status real | Risco de subestimativa |
|---|---|---|---|
| F-02 Auth | 12 (F0-01..F0-05) | 🟡 Parcial (reescrever auth, não começar do zero) | ✅ OK |
| F-01 Hospitais | 16 (S1) | 🔴 Inexistente | ⚠️ Médio |
| F-03 Geofence | 19 (S2) | 🔴 Inexistente | ⚠️ Alto (geofencing nativo tem risco iOS) |
| F-04 Visita | 21 (S3) | 🔴 Inexistente | ✅ OK |
| F-05 Feedback | 16 (S4) | 🔴 Inexistente | ✅ OK |
| F-06 Indicadores | 20 (S5) | 🔴 Inexistente | ✅ OK |
| F-07 Mapa | 8 (parcial) | 🟡 Parcial | ✅ OK (menos esforço por já ter mapa) |
| F-08 Polimento | 20 (S6) | 🟡 Parcial | ⚠️ Médio (refatoração de telas existentes) |
| F-09 Segurança | 18 (S0) | 🔴 Não conforme | ✅ OK (crítico, mas escopo claro) |

---

## 4. Arquivos que serão descartados ou totalmente reescritos

| Arquivo | Destino |
|---|---|
| `GeoLocalizacaoService.js` (watchPositionAsync) | ❌ Substituído por geofencing nativo + heartbeat |
| `GeoLocalizacaoScreen.js` (mapa GPS contínuo) | ❌ Reescrito como tela de mapa com hospitais + geofences |
| `AuthServiceImpl.java` (senha texto puro) | ❌ Reescrito com BCrypt + JWT |
| `AuthController.java` (login sem token) | ❌ Reescrito com JWT + refresh + logout |
| `LoginScreen.js` (assets antigos, HIPAA) | ❌ Refatorado para Design System v2.0 + LGPD |
| `App.js` (Drawer navigation) | ❌ Substituído por Bottom Tabs |

---

## 5. Arquivos que serão mantidos com alterações

| Arquivo | Alteração |
|---|---|
| `UserDocument.java` | ✅ Mantido (adicionar consentimentos LGPD) |
| `UserController.java` | 🔄 Adicionar endpoints de perfil, exclusão |
| `UserServiceImpl.java` | 🔄 Adicionar lógica de consentimento, exclusão LGPD |
| `UserScreen.js` | 🔄 Pequenos ajustes de navegação (Bottom Tabs) |
| `HomeScreen.js` | 🔄 Adicionar card de visita ativa |
| `GlobalExceptionHandler.java` | 🔄 Padronizar envelope de erro |
| `docker-compose.yml` | 🔄 Adicionar Redis (futuro) |
| `app.json` | 🔄 Adicionar permissão de background location |
| `api.js` | ✅ Mantido como está |

---

## 6. Recomendações

1. **Fase 0 (Sprint 0) começa pelo arquivo mais crítico: `AuthServiceImpl.java` linha 28** — trocar `document.setPassword(request.password())` por `passwordEncoder.encode(request.password())`. Isso sozinho resolve o maior risco do projeto.
2. **Sprint S2 deve começar com teste de geofencing em device iOS real** — o `startGeofencingAsync` do Expo tem comportamento diferente entre Android e iOS; validar no dia 1.
3. **F-07 (Mapa) poderia ser adiantada para S1** — o `MapView` já existe, e a listagem de hospitais no mapa depende apenas de F-01 estar pronto. Isso daria uma demo visual já no final do S1.
4. **O esforço total estimado (130 pts) parece realista** dado que ~56% das features partem do zero, mas o risco está concentrado em F-03 (geofencing iOS) — adicionar 1 semana de buffer específica para isso.
