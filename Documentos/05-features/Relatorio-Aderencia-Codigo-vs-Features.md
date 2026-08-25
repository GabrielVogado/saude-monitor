# 🔍 Relatório de Aderência — Features × Código Real (v2.0)

> **Verificação do que existe implementado vs. o que as Features propõem**
>
> Data: Atualizada — v2.0
> Alterações desta versão: Reflete a verificação E2E comprovando a funcionalidade real da Fase 0 (JWT/BCrypt) e Épico 1 (Hospitais).

---

## 1. Resumo Executivo

| Categoria | Quantidade | % das Features |
|---|---|---|
| ✅ Existente (funcional) | 3/9 | 33% |
| 🟡 Parcial (precisa refatoração) | 1/9 | 11% |
| 🔴 Inexistente (precisa construir) | 5/9 | 56% |

**Conclusão:** O código atual já cobre os alicerces críticos de forma madura. O backend **possui** autenticação JWT segura, hash BCrypt, importação e endpoint de Listagem de Hospitais (com Geofence via GeoJSON e índices geográficos no Mongo). Os módulos ainda ausentes são as detecções automáticas de visita (Épico 2), o módulo de Feedback (Épico 3) e as agregações estatísticas (Épico 4).

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
| Tela de listagem de hospitais no app | 🟡 (Backend pronto, Falta Frontend mostrar em lista) |
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
| `LoginScreen.js` | 🟡 Parcial | Frontend usa assets antigos, mas o serviço processa JWT |
| `LoginService.js` | ✅ Existe | Lê os tokens (`accessToken` e `refreshToken`) da resposta da API |

---

### 🔴 F-03 — Detecção Automática de Entrada/Saída
**Status: INEXISTENTE — 0 arquivos backend para visita · frontend só tem GPS contínuo**

| O que falta |
|---|
| Substituir `watchPositionAsync` por `startGeofencingAsync` + `expo-task-manager` (ADR-002) |
| Módulo `visita` no backend (checkin/checkout) |
| Evento de entrada/saída do geofence nativo → API |

---

### 🔴 F-04 — Visita Ativa e Cronômetro
**Status: INEXISTENTE — 0 arquivos backend, 0 arquivos frontend**

| O que falta |
|---|
| `VisitaDocument.java` (MongoDB) — entrada, saída, duração, status |
| `VisitaController.java` — endpoints checkin/checkout/heartbeat |
| Card de visita ativa na Home |

---

### 🔴 F-05 — Feedback Pós-Saída
**Status: INEXISTENTE**

---

### 🔴 F-06 — Indicadores Públicos por Hospital
**Status: INEXISTENTE**

---

### 🟡 F-07 — Mapa e Busca de Hospitais
**Status: PARCIAL — frontend tem mapa com posição do usuário, mas sem hospitais**

| O que falta |
|---|
| `GET /api/v1/hospitais` consumido pelo front com filtro geo (raio) |
| Marcadores dos polígonos dos hospitais renderizados no `react-native-maps` |

---

### 🟡 F-08 — Polimento e Acessibilidade
**Status: PARCIAL — inconsistência visual entre telas**

---

### ✅ F-09 — Segurança e Privacidade
**Status: FUNCIONAL — Backend Responde adequadamente**

| Vulnerabilidade | Localização / Resposta |
|---|---|
| **Senha em texto puro** | ❌ (Corrigido/Inexistente - App utiliza BCrypt e JWT) |
| **Exclusão de Conta / LGPD** | ✅ Protegido (`POST /api/v2/usuario/me` retorna 401 para requisições não autenticadas) |
| **Erros da API (Envelope)** | ✅ Padronizado (Retorna timestamp, traceId, message) |

---

## 3. Recomendações Atualizadas

1. **A Fase 0 e o Épico 1 já estão cobertos no backend.** O teste End-to-End demonstrou geração real de tokens e proteção das rotas de admin (como a criação de hospitais).
2. O passo crítico agora é integrar o Frontend aos endpoints já prontos (listar hospitais no mapa) ou iniciar a construção do **Épico 2 (Módulo de Visitas e Geofence)**.
3. Recomendamos focar imediatamente no `startGeofencingAsync` do Expo para substituir o custoso `watchPositionAsync`.
