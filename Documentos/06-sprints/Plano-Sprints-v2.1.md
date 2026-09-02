# 🏃 Plano de Sprints — Clinical Sanctuary v2.1

> **Plano de entregas ágeis para o MVP do sistema de monitoramento hospitalar por geolocalização**
>
> | Campo | Valor |
> |---|---|
> | **Versão** | 2.0 |
> | **Status** | Vigente — S0–S6 e S8 concluídas; S7 adiada; S9–S12 planejadas em 02/09/2026 |
> | **Data** | 07/08/2026 · **Revisão v2.1:** 02/09/2026 |
> | **Autor** | Gabriel Vogado (Scrum Master / PO) |
> | **Referências** | Documento Negocial v2.0 · Árvore Tecnológica v2.0 · **Backlog MVP v2.1** · Especificação API v2.0 · Padrão UI/UX v2.0 · **Features MVP v2.1** |
> | **O que mudou na v2.1** | (1) **§20 (S7 — Painel Admin) marcada como ADIADA** por decisão do PO; (2) **§21 (S8) marcada como CONCLUÍDA** em 01/09/2026, com duas correções de escopo que o plano não registrava: a exportação saiu de **CSV para PDF** e a biblioteca de mapa é **`@maplibre/maplibre-react-native`**, não `react-native-maps`; (3) novo **§22 com as sprints S9–S12**, que o plano original não previa — ele terminava em "S6 — Polimento e Lançamento", como se o lançamento fosse consequência automática do fim do desenvolvimento. |

---

## 1. Visão Geral do Plano

### 1.1 Resumo executivo

O plano de sprints do **Clinical Sanctuary** organiza 31 estórias de usuário (6 épicos + Fase 0) em **7 sprints de 2 semanas**, totalizando **12 semanas de desenvolvimento** (excluindo 2 semanas de buffer para imprevistos, testes de campo e deploy). O objetivo é entregar um MVP funcional que permita detectar automaticamente a entrada/saída de usuários em áreas hospitalares, coletar feedback pós-atendimento e exibir indicadores públicos de qualidade por hospital.

> 📍 **Onde o projeto está em 02/09/2026 (acrescentado na v2.1).**
>
> **Concluído:** S0, S1, S2, S3, S4, S5, S6 e **S8** (esta última em 01/09/2026, PRs #48–#52, `develop@f26666e`). **42 das 43 estórias do escopo mobile** estão entregues — resta apenas E4-06 (tendência simples, P2).
>
> **Não executado:** **S7 (Painel Administrativo Web)**, adiada por decisão do Product Owner — ver §20.
>
> **O que o plano original não previu:** entre "código entregue" e "lançamento" existem quatro sprints que não estavam aqui. O sistema está funcionalmente completo, mas **não é utilizável**: a primeira abertura do app após ociosidade leva **109 s e retorna HTTP 503**, e mesmo com o serviço quente cada requisição custa **1 a 5 s**. É por isso que os testes de campo previstos no §15 nunca puderam ser executados. O tratamento está no **§22 (S9–S12)** e no **Épico 8** do `Backlog-MVP-v2.1.md`.

### 1.2 Dados mestres do plano

| Parâmetro | Valor |
|---|---|
| **Duração total** | 14 semanas (12 de desenvolvimento + 2 de buffer) |
| **Sprints de desenvolvimento** | 7 (S0 a S6, 2 semanas cada) |
| **Time-base** | 3 pessoas: 1 Backend (BE), 1 Frontend (FE), 1 DevOps/QA |
| **Velocity alvo** | 18–20 story points por sprint |
| **Pontos totais estimados** | 135 story points (escala Fibonacci: 1, 2, 3, 5, 8, 13) |
| **Épicos** | 6 (E1–E6) + Fase 0 (estabilização) |
| **Estórias** | 32 (todas do backlog v2.0) |
| **Cerimônias** | Daily 15min · Planning 2h · Review 1h · Retro 1h · Refinement 1h (meio do sprint) |
| **Ferramentas** | Jira/Linear (tracking) · Confluence/Notion (docs) · Slack/Teams (async) · GitHub (código) |

### 1.3 Premissas críticas do plano

1. **Fase 0 (Sprint 0) é inegociável**: hash BCrypt + JWT + envelope de erro antes de qualquer endpoint público. O código atual tem senha em texto puro — corrigir é pré-requisito.
2. **Geofencing nativo** (`startGeofencingAsync`) substitui `watchPositionAsync` contínuo até o Sprint S2 — sem isso, iOS não funciona em background e a bateria drena.
3. **Heartbeat (E2-09) é P0** e deve entrar no S2 junto com a detecção básica — sem heartbeat, a expiração por 24h (RN-04) não funciona e visitas longas de 12h+ do SUS seriam perdidas.
4. **Sinalização de internação (E2-10)** deve entrar no S3 — sem ela, internações longas distorcem o indicador de tempo médio de pronto-atendimento (RN-24).
5. **Teste de campo de geofence** em ≥ 3 hospitais reais deve ocorrer entre S3 e S4 para calibrar raios, tolerâncias e intervalo de heartbeat.
6. **Definição de Pronto (DoD)** do MVP aplica-se a partir do S1 — ver seção dedicada.

### 1.4 Mapa de dependências entre sprints

```
S0 (Segurança)
 │
 ├─► S1 (Hospitais + Geofence Admin)
 │    │
 │    └─► S2 (Detecção de Visitas — mobile + backend)
 │         │
 │         ├─► S3 (Robustez de Visitas + Heartbeat + Feedback Backend)
 │         │    │
 │         │    └─► S4 (Feedback Mobile + Notificações)
 │         │         │
 │         │         └─► S5 (Indicadores Públicos + Conta/Privacidade)
 │         │              │
 │         │              └─► S6 (Polimento + Lançamento)
 │         │
 │         └── Teste de campo de geofence (entre S3 e S4)
 │
 └── Segurança (BCrypt + JWT) — todo endpoint público depende disto
```

**Dependências explícitas:**
- **S1 → S2:** Hospitais com geofence precisam estar cadastrados para detectar visitas.
- **S2 → S3:** Detecção básica de entrada/saída precisa funcionar antes de robustez (expiração, conflito, heartbeat).
- **S3 → S4:** Feedback backend (dedupe, anônimo) precisa existir antes do frontend de feedback.
- **S4 → S5:** Feedbacks precisam existir para calcular agregados públicos.
- **S5 → S6:** Indicadores públicos precisam estar prontos para o polimento final (E4-05 ranking).

---

## 2. Sprint 0 — Estabilização e Segurança 🔥

> **2 semanas · 18 story points · Timebox: S0**

### 2.1 Objetivo do sprint

> **"Tornar o sistema seguro para exposição pública: senha com hash, autenticação JWT, erros padronizados e conformidade LGPD básica (direito de exclusão). Nenhum endpoint de negócio é exposto sem essas fundações."**

### 2.2 Estórias do sprint

| ID | Prioridade | Estória | Pontos | Resp. | Tipo |
|---|---|---|---|---|---|
| F0-01 | P0 | Hash de senhas com BCrypt | 3 | BE | 🔄 Refatorar |
| F0-02 | P0 | Autenticação JWT (access 15min + refresh 30d) | 8 | BE + FE | ➕ Nova |
| F0-03 | P0 | Envelope de erro padronizado (código, mensagem pt-BR, timestamp, traceId) | 2 | BE | 🔄 Refatorar |
| F0-05 | P0 | Exclusão de conta e dados pessoais (direito LGPD) | 5 | BE + FE | ➕ Nova |

**Nota:** F0-04 (Rate limiting) é P1 e foi movido para S6 — o volume do MVP não justifica antes do lançamento, e o custo de implementar sem tráfego real é desperdício.

### 2.3 Entregáveis esperados

- [x] **BCrypt operacional**: `AuthServiceImpl.saveLogin()` refatorado; senha nunca gravada em claro; comparação via `PasswordEncoder`; teste unitário validando irreversibilidade do hash.
- [x] **JWT funcional**: endpoint `POST /api/auth/login` retorna `accessToken` (15min) + `refreshToken` (30d); endpoint `POST /api/auth/refresh` rotaciona tokens; endpoint protegido rejeita sem token (401); `expo-secure-store` configurado no app.
- [x] **GlobalExceptionHandler padronizado**: 100% dos erros seguem o envelope `{ timestamp, status, code, message, details, traceId }`; cobre validação, 404, 401, 403, 500; mensagens em pt-BR.
- [x] **Endpoint de exclusão LGPD**: `DELETE /api/v1/usuarios/me` remove usuário, auth e feedbacks vinculados; agregação anonimiza dados; resposta com resumo do que foi removido.
- [x] **Testes de integração básicos**: cobertura de auth (login, refresh, logout, acesso negado) e exclusão LGPD.

### 2.4 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| JWT + Spring Security com complexidade inesperada (configuração, filtros) | Média | Alto | BE começa F0-02 no dia 1; spike de 4h se travar; fallback: JWT manual sem Spring Security (não ideal, mas funcional) |
| Exclusão LGPD com cascade complexo (visitas, feedbacks, agregados) | Média | Médio | FE começa tela de perfil em paralelo; BE foca no cascade de dados; se complexidade explodir, reduzir escopo para "soft delete + anonimização" em vez de deleção física |
| Curva de aprendizado do DevOps/QA (time novo) | Baixa | Baixo | S0 é majoritariamente BE; DevOps foca em setup de ambiente, CI básico e preparação de testes |

### 2.5 Definition of Ready (DoR) do sprint

- [x] Estórias com critérios de aceite claros (documentados no backlog v2.0).
- [x] Contratos de API esboçados (auth, user) — especificação formal no S1.
- [x] Dependências externas mapeadas (Spring Security, BCrypt, expo-secure-store).
- [x] Ambiente de dev funcional (Docker Compose com MongoDB 7).

### 2.6 Definition of Done (DoD) do sprint

- [x] Código revisado e mergeado na `main`.
- [x] Testes unitários de auth e erro com cobertura ≥ 70%.
- [x] Testes de integração para fluxo de login/logout/refresh/exclusão.
- [x] Documentação de setup de segurança no `README.md`.
- [x] Nenhum endpoint público exposto sem auth (validação manual + teste automatizado).

---

## 3. Sprint S1 — Hospitais, Geofence Admin e Moderação de Sugestões 🏥

> **2 semanas · 21 story points · Depende de: S0 concluído**

### 3.1 Objetivo do sprint

> **"Permitir que administradores cadastrem hospitais com áreas geográficas (geofence GeoJSON) no mapa, que o app público liste os hospitais ativos com seus indicadores, e que administradores revisem, aprovem e rejeitem sugestões públicas de novos hospitais."**

### 3.2 Estórias do sprint

| ID | Prioridade | Estória | Pontos | Resp. | Tipo |
|---|---|---|---|---|---|
| E1-01 | P0 | CRUD de hospital (nome, CNPJ, tipo, endereço, contato, status) | 5 | BE | ➕ Nova |
| E1-02 | P0 | Definição de geofence como polígono GeoJSON sobre o mapa | 5 | BE + FE | ➕ Nova |
| E1-03 | P0 | Listagem de hospitais ativos para o app público (com indicadores) | 3 | BE + FE | ➕ Nova |
| E1-04 | P1 | Edição e desativação de hospital/geofence | 3 | BE + FE | ➕ Nova |
| E1-05 | P1 | Sugestão pública de hospital (endpoint + tela anônima) | 2 | BE + FE | ➕ Nova |
| E1-06 | P1 | Moderação de sugestões: aprovar/rejeitar com audit trail | 5 | BE + FE | ➕ Nova |

### 3.3 Entregáveis esperados

- [x] **Módulo `hospital` no backend**: documento MongoDB com `geofence` (GeoJSON Polygon), índice `2dsphere`, validação de polígono (fechado, ≥ 3 vértices, sem auto-interseção).
- [x] **CRUD administrativo**: `POST /api/v1/hospitais` (🛡️ admin), `PUT /api/v1/hospitais/{id}`, `PATCH /api/v1/hospitais/{id}/status`.
- [x] **Endpoint público de listagem**: `GET /api/v1/hospitais` 🔓 — filtro por raio (`$near`), tipo, busca textual; paginado; resposta < 300ms p95.
- [x] **Tela de cadastro de hospital no app**: mapa interativo (`react-native-maps`) com ferramenta de desenho de polígono; visualização do geofence salvo.
- [x] **Tela de lista de hospitais** (modo público): Bottom Tab "Hospitais", renderização de cards com nome, tipo e indicadores (placeholder até S5).
- [x] **Índice 2dsphere** criado e testado com queries `$geoIntersects` e `$near`.
- [x] **Sugestão pública de hospital**: endpoint `POST /api/v1/hospitais/sugestoes` e tela no app para usuário anônimo/logado enviar proposta.
- [x] **Moderação de sugestões**: endpoints admin `GET /api/v1/hospitais/sugestoes`, `POST /api/v1/hospitais/sugestoes/{id}/aprovar`, `POST /api/v1/hospitais/sugestoes/{id}/rejeitar`; tela de fila de moderação acessível apenas para admin; fluxo de aprovação pré-preenche formulário de hospital e vincula sugestão ao hospital criado; rejeição exige motivo e persiste audit trail.

### 3.4 Demo planejada

> **"Cadastrar 3 hospitais reais (ex.: Santa Casa SP, HC SP, Hospital das Clínicas) com geofences desenhados no mapa, listá-los no app público com busca por nome e ver o polígono renderizado; depois, enviar uma sugestão pública de novo hospital, acessar como admin, aprovar a sugestão preenchendo o formulário completo e ver o novo hospital ativo na lista pública."**

### 3.5 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Desenho de polígono no mapa mobile com UX ruim (biblioteca de edição limitada no RN) | Média | Médio | FE faz spike de 4h com `react-native-maps` Polygon edition; fallback: admin web simples (HTML+JS) para cadastro de geofence, app apenas exibe |
| Validação GeoJSON complexa (auto-interseção, orientação) | Baixa | Médio | Usar biblioteca JTS (Java Topology Suite) ou `org.springframework.data.mongodb.core.geo`; se complexidade explodir, validação simplificada (apenas vértices e fechamento) |
| Performance de `$near` em coleção pequena irrelevante, mas design precisa escalar | Baixa | Baixo | Índice 2dsphere cobre o cenário; teste de carga só no S6 |
| Aprovação de sugestão sem geofence válido gera hospital inutilizável | Média | Alto | Fluxo de aprovação obriga passar pelo `HospitalFormScreen` completo com validação de geofence antes de vincular a sugestão |
| Spam de sugestões falsas sobrecarrega moderação | Média | Médio | Rate limiting no endpoint público `POST /sugestoes`; moderação manual no MVP; futuro: reCAPTCHA/device fingerprinting |
| UI mobile de moderação ruim para volume alto | Baixa | Médio | Reutilizar componentes do design system; se volume de sugestões for alto, evoluir para painel web na Fase 2 |

### 3.6 Definição de Pronto (DoD) do sprint

- [x] CRUD completo de hospital com validação GeoJSON.
- [x] Índice 2dsphere funcional e testado com queries reais.
- [x] Listagem pública paginada e com busca.
- [x] Tela de mapa com renderização de polígono.
- [x] Testes de integração para CRUD e validação de geofence.
- [x] Sugestão pública funcional e criando registro `PENDENTE`.
- [x] Moderação de sugestões: endpoints protegidos para admin, transições de status testadas, rejeição exige motivo, aprovação vincula hospital com geofence.
- [x] Tela de fila de moderação no app, acessível apenas para admin, com atualização automática após aprovação/rejeição.
- [x] Cobertura de testes unitários ≥ 70% nos métodos de moderação.

----

## 4. Sprint S2 — Detecção de Visitas (Mobile + Backend) 📍

> **2 semanas · 19 story points · Depende de: S1 concluído (hospitais cadastrados)**

### 4.1 Objetivo do sprint

> **"Detectar automaticamente a entrada e saída do usuário em áreas hospitalares via geofencing nativo, registrar visitas no backend, exibir card de visita ativa com cronômetro e implementar heartbeat de presença."**

### 4.2 Estórias do sprint

| ID | Prioridade | Estória | Pontos | Resp. | Tipo |
|---|---|---|---|---|---|
| E2-01 | P0 | Detecção automática de entrada (≥ 2 min no geofence) | 5 | FE + BE | ➕ Nova |
| E2-02 | P0 | Detecção automática de saída (≥ 5 min fora do geofence) | 5 | FE + BE | ➕ Nova |
| E2-06 | P0 | Check-in manual em 1 toque (caminho de primeira classe; essencial com GPS desligado/negado) | 3 | FE + BE | ➕ Nova |
| E2-07 | P0 | Card de visita ativa com cronômetro (home + notificação persistente) | 3 | FE | ➕ Nova |
| E2-09 | P0 | Heartbeat de presença a cada 30 minutos | 3 | FE + BE | ➕ Nova |

### 4.3 Por que estas estórias estão juntas?

- **E2-01 e E2-02 são indivisíveis**: entrada e saída formam o ciclo completo de uma visita; desenvolver uma sem a outra gera retrabalho de integração.
- **E2-09 (heartbeat) é P0 e está junto com detecção básica**: o heartbeat é o que distingue "espera real no hospital" (12h+ no SUS) de "GPS preso". Sem ele, a expiração de 24h (E2-03 no S3) não tem como saber se o usuário ainda está no hospital. **Desenvolver detecção sem heartbeat é construir sobre premissa errada.**
- **E2-06 (check-in manual) é um caminho de primeira classe**: ao lado do fluxo automático (geofence), essencial com GPS desligado, permissão negada ou iOS restritivo, sem comprometer a fricção mínima. O app funciona com ou sem o manual. while (200- **E2-09 (heartbeat) é P0 e está junto com detecção básica**: o heartbeat é o que distingue "espera real no hospital" (12h+ no SUS) de "GPSpreso". Sem ele, a expiração de 24h (E2-03 no S3) não tem como saber se o usuário ainda está no hospital. **Desenvolver detecção sem heartbeat é construir sobre premissa errada.**

### 4.4 Migração crítica: `watchPositionAsync` → `startGeofencingAsync`

O código atual usa `expo-location.watchPositionAsync` com `Accuracy.BestForNavigation` a cada 2 segundos — **isso drena a bateria e não roda em background no iOS**. Neste sprint, o FE migra para:

```javascript
// Antes (S0–S1, apenas durante telas abertas)
Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000 }, callback);

// Depois (S2 em diante)
Location.startGeofencingAsync("hospitalGeofence", geofenceRegions);
TaskManager.defineTask("GEOFENCE_TASK", ({ data, error }) => { /* checkin/checkout */ });
```

**Impacto esperado:** consumo de bateria de ~15–20%/dia (GPS contínuo) para < 5%/dia (geofencing nativo). Compatível com background em Android e iOS.

### 4.5 Entregáveis esperados

- [x] **Geofencing nativo funcional**: `startGeofencingAsync` registra regiões de todos os hospitais ativos; `TaskManager` processa eventos `ENTER`/`EXIT` em background.
- [x] **Módulo `visita` no backend**: endpoints `POST /visitas/checkin` e `POST /visitas/{id}/checkout`; validação `$geoIntersects` no checkin; idempotência (checkin duplicado retorna visita existente).
- [x] **Fluxo completo de detecção**: ENTER → checkin → `EM_ATENDIMENTO` → EXIT → checkout → `FINALIZADA` com `duracaoMinutos`.
- [x] **Check-in manual**: botão "Estou em um hospital" na home; seleção de hospital da lista; flag `origem=MANUAL`; funciona sem GPS.
- [x] **Card de visita ativa**: cronômetro ao vivo na tela Home; notificação silenciosa persistente "Você está no Hospital X — 02:35"; atualização a cada 1 minuto.
- [x] **Heartbeat**: app envia `POST /visitas/{id}/heartbeat` a cada 30min enquanto `EM_ATENDIMENTO`; backend atualiza `ultimoHeartbeat`; se estava `SUSPEITA`, retorna a `EM_ATENDIMENTO`.

### 4.6 Demo planejada

> **"Simular entrada em geofence de hospital real (ex.: caminhar até o perímetro do HC), ver card de visita ativa aparecer automaticamente com cronômetro, simular saída após 5 minutos, ver visita finalizada com duração correta. Demonstrar check-in manual como fallback. Mostrar heartbeats no log do backend a cada 30 minutos."**

### 4.7 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| `startGeofencingAsync` com comportamento imprevisível em iOS (regiões limitadas a 20, latência de detecção) | Alta | Alto | Testar em device iOS real no dia 1; limitar regiões a 20 mais próximas; tolerância de 2min (RN-01) absorve latência de 30–60s do SO |
| Heartbeat com consumo de rede/bateria acima do esperado | Média | Médio | Medir consumo no emulador e device real; se > 2% bateria/dia, aumentar intervalo para 60min (requer ajuste de RN-23 com PO) |
| Geofence sobreposto (2 hospitais na mesma quadra) gerando ambiguidade | Baixa | Médio | E2-04 (conflito) entra no S3; no S2, se ocorrer, registra no hospital mais próximo (distância euclidiana); logar ocorrências para calibrar |
| Indisponibilidade do BE para testar FE (dependência forte) | Média | Médio | FE começa com mock de API (json-server ou MSW); integração real na segunda semana; BE entrega checkin/checkout até dia 5 |

### 4.8 Definição de Pronto (DoD) do sprint

- [x] Geofencing nativo detecta entrada/saída em device real (Android e iOS).
- [x] Ciclo completo de visita (ENTRY → EM_ATENDIMENTO → EXIT → FINALIZADA) testado de ponta a ponta.
- [x] Heartbeat enviado e registrado a cada 30min.
- [x] Check-in manual funcional como fallback.
- [x] Card de visita ativa visível e atualizando.
- [x] Testes de integração para checkin/checkout/heartbeat.
- [x] Logs de geofence events para debug (nível INFO, sem dados pessoais).

---

## 5. Sprint S3 — Robustez de Visitas + Feedback Backend 🛡️

> **2 semanas · 21 story points · Depende de: S2 concluído (checkin/checkout funcionando)**

### 5.1 Objetivo do sprint

> **"Tornar o sistema de visitas robusto contra falhas (expiração por inatividade, conflito de áreas, GPS interrompido, sinalização de internação) e construir o backend de feedback (dedupe, anônimo, agregação)."**

### 5.2 Estórias do sprint

| ID | Prioridade | Estória | Pontos | Resp. | Tipo |
|---|---|---|---|---|---|
| E2-03 | P0 | Expiração de visitas após 24h sem heartbeat (job de limpeza) | 5 | BE | ➕ Nova |
| E2-04 | P0 | Tratamento de conflito de áreas sobrepostas (hospital mais próximo) | 3 | BE | ➕ Nova |
| E2-05 | P1 | Recuperação de visitas com GPS interrompido (até 10 min) | 3 | FE + BE | ➕ Nova |
| E2-10 | P1 | Sinalização de internação/observação após 12h de visita ativa | 3 | FE + BE | ➕ Nova |
| E2-08 | P1 | Filtro de visitas < 2 minutos nas estatísticas públicas | 2 | BE | ➕ Nova |
| E3-04 | P0 | Bloqueio de feedback duplicado por visita (unique index) | 2 | BE | ➕ Nova |
| E3-05 | P0 | Feedback anônimo (sem login) | 3 | BE | ➕ Nova |

### 5.3 Por que estas estórias estão juntas?

- **E2-03 (expiração) e E2-05 (GPS interrompido)** são duas faces da mesma moeda: o que acontece quando a visita "some". E2-03 cobre "usuário saiu mas GPS não detectou"; E2-05 cobre "GPS caiu temporariamente". Implementá-las juntas evita duplicação de lógica de timeout.
- **E2-10 (sinalização de internação)** fecha o ciclo de robustez: sem ela, internações de 3 dias no SUS distorceriam o "tempo médio de pronto-atendimento" (RN-24). É P1 porque o MVP pode lançar sem, mas o dado público ficaria poluído — **recomendação forte de incluir**.
- **E3-04 e E3-05 (feedback backend)** são pré-requisito para o S4 (feedback mobile). Implementar o backend agora evita que o time de FE fique bloqueado na semana 1 do S4.
- **E2-08 (filtro < 2min)** é trivial (2 pts) e completa a lógica de agregação.

### 5.4 Entregáveis esperados

- [x] **Job de expiração**: scheduler (ex.: `@Scheduled` a cada 15min) varre visitas `EM_ATENDIMENTO` ou `SUSPEITA` com `ultimoHeartbeat` > 24h → `EXPIRADA`; tempo parcial preservado; log de expirações para auditoria.
- [x] **Resolução de conflito**: se `$geoIntersects` retorna > 1 hospital, `$near` desempata pela distância ao centróide; se empate (< 5m de diferença), app exibe prompt de 1 toque.
- [x] **Recuperação de GPS**: falha ≤ 10min mantém status; após 10min sem sinal → `GPS_INTERROMPIDO` com duração parcial.
- [x] **Sinalização de internação**: após 12h de `EM_ATENDIMENTO`, app exibe prompt "Você está em observação ou internado?"; resposta grava `tipoPermanencia`; visita continua ativa mas é excluída do cálculo de tempo médio de pronto-atendimento.
- [x] **Módulo `feedback` no backend**: coleção `feedbacks` com índice unique em `visitaId`; endpoint `POST /api/v1/feedbacks` 🔓 (aceita `usuarioId` nulo para anônimo); validação de enums (`foiAtendido`, `teveMedico`, `fezTriagem`, `nota` 1–5).
- [x] **Agregação básica**: job que recalcula `AGREGADO_HOSPITAL` (materializado) — nota média, N, tempo mediano; filtro de visitas < 2min (E2-08); exclusão de `OBSERVACAO`/`INTERNACAO` (E2-10).

### 5.5 Demo planejada

> **"Simular GPS preso (desligar após checkin) e ver expiração após 24h simuladas (acelerar job). Simular 2 geofences sobrepostos e ver app escolher o mais próximo ou perguntar. Simular visita de 13h com heartbeat ativo (não expira) e prompt de internação aparecendo. Enviar 2 feedbacks para a mesma visita e ver o segundo ser rejeitado com erro amigável."**

### 5.6 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Job de expiração com falsos positivos (expirar visita legítima) | Média | Alto | Log detalhado de cada expiração; período de "soft expiration" (marca `SUSPEITA` antes de `EXPIRADA`); dash de monitoramento de expirações/dia |
| Cálculo de mediana em MongoDB (não tem operador nativo `$median`) | Média | Médio | Buscar valores, ordenar no backend e calcular mediana em memória (Java); para N ≤ 1000 por hospital, performance é irrelevante; cache no `agregado` evita recomputação |
| Sinalização de internação com baixa taxa de resposta (usuário ignora o prompt) | Alta | Baixo | Comportamento padrão: se ignorar, visita permanece como `ATENDIMENTO` e entra na métrica — pior caso: algumas internações não-sinalizadas poluem a métrica, mas o impacto é diluído pelo N |
| Complexidade de teste do job de expiração | Baixa | Médio | Criar perfil `test` com intervalo de job configurável (ex.: 1min); testes de integração com clock fixo |

### 5.7 Definição de Pronto (DoD) do sprint

- [x] Job de expiração funcional com cobertura de teste.
- [x] Conflito de áreas resolvido (distância + prompt).
- [x] GPS interrompido tratado com timeout de 10min.
- [x] Prompt de internação funcional após 12h.
- [x] Endpoint de feedback com dedupe e suporte anônimo.
- [x] Agregação materializada funcional (job disparado após novo feedback).
- [x] Filtro de visitas < 2min aplicado.

---

## 6. Sprint S4 — Feedback Mobile + Notificações 📝

> **2 semanas · 16 story points · Depende de: S3 concluído (feedback backend pronto)**

### 6.1 Objetivo do sprint

> **"Entregar a experiência completa de feedback pós-saída: notificação local no momento certo, formulário de 4 perguntas em < 45s, agradecimento com impacto, e lembretes não-invasivos."**

### 6.2 Estórias do sprint

| ID | Prioridade | Estória | Pontos | Resp. | Tipo |
|---|---|---|---|---|---|
| E3-01 | P0 | Notificação de feedback entre 1 e 5 minutos após saída | 3 | FE | ➕ Nova |
| E3-02 | P0 | Formulário de feedback (4 perguntas, pulável, < 45s, chips de medicação) | 8 | FE | ➕ Nova |
| E3-03 | P0 | Janela de 24h para responder com no máximo 1 lembrete | 3 | FE | ➕ Nova |
| E3-06 | P1 | Tela de agradecimento e impacto ("Sua avaliação ajuda X pessoas") | 2 | FE | ➕ Nova |

### 6.3 Entregáveis esperados

- [x] **Notificação local pós-saída**: disparo entre 1–5min após checkout; nunca dentro do geofence; `expo-notifications` configurado; permissão solicitada com explicação.
- [x] **Fluxo completo do formulário (FeedbackSheet)**:
  - **Pergunta 1**: "Você foi atendido?" (Sim, fui atendido / Sim, mas desisti / Não fui atendido) — se "Não", pula para nota.
  - **Pergunta 2**: "Teve médico disponível?" (Sim / Não / Não precisei).
  - **Pergunta 3**: "Fez triagem?" (Sim / Não / Não sei).
  - **Pergunta 4**: "Como você avalia?" (estrelas 1–5, obrigatória para envio).
  - **Chips rápidos**: "Recebeu medicação ou receita?" (Sim, recebi / Não recebi / Não precisei).
  - **Comentário opcional**: campo de texto livre.
  - **Botão "Pular"** sempre visível em cada etapa.
- [x] **Progresso visível**: barra de progresso (1/4, 2/4...) ou indicador de etapa.
- [x] **Meta de tempo**: fluxo completo respondido em < 45s (medido e otimizado).
- [x] **Lembrete único**: ~6h após notificação inicial se não respondido; nunca mais de 1 lembrete; após 24h, visita marcada `SEM_FEEDBACK`.
- [x] **Tela de agradecimento**: "Sua avaliação ajuda X pessoas por semana a escolher melhor"; link para ver a nota atualizada do hospital.

### 6.4 Demo planejada

> **"Simular ciclo completo: entrar no geofence (S2) → sair (S2) → receber notificação em 2 min → abrir formulário → responder 4 perguntas em < 30s → ver tela de agradecimento com impacto → ver hospital com N incrementado."**

### 6.5 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Formulário complexo (múltiplos estados, animações, validação) estourar 8 pts | Média | Alto | FE dedica 80% do sprint a E3-02; usar componentes do Design System prontos (Button, RatingStars, FeedbackSheet); mock de API desde o dia 1 |
| Notificação local não disparar em iOS (restrições de background) | Média | Médio | Testar em device iOS real; garantir que `expo-notifications` tem permissão; fallback: exibir tela de feedback ao abrir o app manualmente após saída |
| Usuário fechar app antes de submit e perder progresso | Baixa | Baixo | Salvar estado do formulário em AsyncStorage; recuperar ao reabrir (within 24h window) |
| Tempo de resposta > 45s em devices lentos | Baixa | Médio | Medir com `Performance.now()`; otimizar re-renders; usar `React.memo` em componentes de pergunta |

### 6.6 Definição de Pronto (DoD) do sprint

- [x] Notificação local dispara entre 1–5min após checkout em Android e iOS.
- [x] Formulário completo funcional com todas as perguntas, chips, comentário e envio.
- [x] Tempo de resposta médio < 45s medido em device real.
- [x] Lembrete único funcional; janela de 24h respeitada.
- [x] Tela de agradecimento com link para hospital.
- [x] Testes de usabilidade com ≥ 3 pessoas (pode ser interno).
- [x] Acessibilidade básica: labels, contraste, alvos ≥ 48dp.

---

## 7. Sprint S5 — Indicadores Públicos + Conta/Privacidade 📊

> **2 semanas · 20 story points · Depende de: S4 concluído (feedbacks existentes para calcular agregados)**

### 7.1 Objetivo do sprint

> **"Exibir indicadores públicos de qualidade por hospital (nota média, tempo mediano, N mínimo), implementar onboarding com consentimento LGPD granular e cadastro/login opcional."**

### 7.2 Estórias do sprint

| ID | Prioridade | Estória | Pontos | Resp. | Tipo |
|---|---|---|---|---|---|
| E4-01 | P0 | Nota média do hospital (1–5, últimos 90 dias, N ≥ 5) | 3 | BE + FE | ➕ Nova |
| E4-02 | P0 | Tempo médio de atendimento (mediana, ≤ 24h, exclui internação/observação) | 3 | BE + FE | ➕ Nova |
| E4-03 | P0 | Tela de detalhe público do hospital (nota, tempo, N, período, atualização) | 3 | FE | ➕ Nova |
| E4-04 | P0 | Atualização de agregados em até 15 minutos após novo feedback | 3 | BE | ➕ Nova |
| E5-01 | P0 | Permissão de localização em etapas com explicação e revogação | 3 | FE | ➕ Nova |
| E5-02 | P0 | Aceite de termos e política de privacidade no onboarding | 2 | FE | ➕ Nova |
| E5-04 | P0 | Cadastro/login opcional (e-mail + senha) integrado ao fluxo | 3 | FE + BE | 🔄 Refatorar |

### 7.3 Entregáveis esperados

- [x] **Indicadores na tela de detalhe do hospital**: nota média com estrelas; tempo mediano formatado (ex.: "1h 35min"); N de avaliações; período ("últimos 90 dias"); data da última atualização; mensagem "Ainda sem avaliações suficientes" quando N < 5.
- [x] **Endpoint de indicadores**: `GET /api/v1/hospitais/{id}/indicadores` 🔓 — retorna do `agregados_hospitais` materializado; `indicadoresDisponiveis: false` quando N < 5.
- [x] **Job de atualização de agregados**: disparado por evento pós-feedback (`@TransactionalEventListener`); recalcula `AGREGADO_HOSPITAL`; tempo máximo de 15min entre feedback e atualização pública (RN-18).
- [x] **Tela de detalhe do hospital**: cards de indicadores; transparência metodológica (ex.: "Calculado com 12 avaliações nos últimos 90 dias"); link para compartilhar; carrega em < 2s (p95).
- [x] **Onboarding LGPD**: explicação clara do uso de localização antes de pedir permissão; aceite de termos com data/versão registrados; política de privacidade acessível em 2 toques; permissão negada não bloqueia consulta pública.
- [x] **Fluxo de cadastro/login**: tela de cadastro com validação (e-mail único, senha ≥ 8 chars); tela de login integrada com JWT do S0; conta opcional — jornada principal funciona sem login.

### 7.4 Demo planejada

> **"Abrir tela de detalhe de hospital com 12 avaliações: ver nota 4.2, tempo mediano 1h 35min, 'atualizado há 3 minutos'. Abrir hospital com 3 avaliações: ver 'Ainda sem avaliações suficientes'. Passar pelo onboarding: conceder localização, aceitar termos, pular cadastro. Depois, cadastrar conta e ver histórico vazio (sem visitas ainda)."**

### 7.5 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Cálculo de mediana em memória (Java) com performance ruim se N crescer | Baixa | Baixo | Para MVP com N < 1000, é irrelevante; cache materializado evita recomputação em cada request; reavaliar se N > 10.000 |
| Usuário rejeitar permissão de localização e app perder funcionalidade core | Alta | Médio | Check-in manual (E2-06) é um caminho de primeira classe ao lado do automático; app continua funcional para consulta pública e feedback; comunicação clara de que sem localização, detecção automática não funciona |
| Onboarding complexo (múltiplos estados: primeira vez, retorno, revogação) | Média | Médio | FE usa máquina de estados finita para onboarding; testar todos os caminhos (permissão concedida, negada, revogada depois) |

### 7.6 Definição de Pronto (DoD) do sprint

- [x] Indicadores públicos exibidos corretamente (nota, tempo, N, período).
- [x] Regra N ≥ 5 respeitada (omite indicadores abaixo).
- [x] Agregado atualizado em ≤ 15min após feedback.
- [x] Onboarding com consentimento granular funcional.
- [x] Cadastro/login integrado e opcional.
- [x] Testes de usabilidade do onboarding com ≥ 3 pessoas.

---

## 8. Sprint S6 — Polimento e Lançamento ✨

> **2 semanas · 20 story points · Depende de: S5 concluído**

### 8.1 Objetivo do sprint

> **"Polir a experiência do usuário (Design System v2.0, Bottom Tabs, acessibilidade, estados de UI), adicionar ranking de hospitais, rate limiting e preparar o lançamento."**

### 8.2 Estórias do sprint

| ID | Prioridade | Estória | Pontos | Resp. | Tipo |
|---|---|---|---|---|---|
| E6-01 | P0 | Navegação por Bottom Tabs (Início, Hospitais, Mapa, Perfil) | 5 | FE | 🔄 Refatorar |
| E6-02 | P0 | Design System v2.0 aplicado em todas as telas | 5 | FE | 🔄 Refatorar |
| E6-03 | P1 | Acessibilidade WCAG AA (leitor de tela, contraste, alvos 48dp) | 3 | FE | ➕ Nova |
| E6-04 | P1 | Estados de carregamento/vazio/erro em todas as telas | 2 | FE | ➕ Nova |
| E4-05 | P1 | Ranking de hospitais ordenável por nota e tempo | 3 | BE + FE | ➕ Nova |
| F0-04 | P1 | Rate limiting em login e endpoints públicos | 2 | BE | ➕ Nova |

### 8.3 Estórias movidas para "stretch" (se velocity permitir)

| ID | Estória | Pontos | Motivo do adiamento |
|---|---|---|---|
| E5-03 | Histórico de visitas e feedbacks do usuário logado | 3 | Menos crítico que polimento visual — pode entrar em patch pós-lançamento (S6+1) |
| E5-05 | Revogação de consentimento de geolocalização sem perder acesso ao app | 2 | Parcialmente coberto por E5-01; revogação completa pode ser patch |

### 8.4 Entregáveis esperados

- [x] **Bottom Tabs implementados**: 4 abas (Início, Hospitais, Mapa, Perfil); substituição do Drawer navigation; navegação de 1 polegar; transições suaves.
- [x] **Design System v2.0 aplicado**: tokens de cor, tipografia, raios, sombras em todas as telas; componentes padronizados (Button, RatingStars, FeedbackSheet, TimerBanner); remoção de assets antigos (GIF, PNGs de ícones); selos LGPD no lugar de "HIPAA Compliant".
- [x] **Acessibilidade**: `accessibilityLabel` e `accessibilityRole` em componentes interativos; alvos de toque ≥ 48dp; contraste de texto ≥ 4.5:1 (AA); teste com TalkBack (Android) e VoiceOver (iOS).
- [x] **Estados de UI**: `LoadingState` (skeleton/spinner), `EmptyState` (ilustração + mensagem), `ErrorState` (mensagem + botão retry) em todas as telas com dados assíncronos.
- [x] **Ranking de hospitais**: `GET /api/v1/hospitais/ranking` 🔓 com ordenação por `nota` ou `tempo`; filtro por tipo (público/privado); paginação; tela dedicada no app.
- [x] **Rate limiting**: login 10 req/min/IP (429); endpoints públicos 60 req/min/IP; bucket4j ou Spring filter; testado com script de carga.
- [x] **Preparação de lançamento**: build de produção (APK/AAB Android + IPA iOS); configuração de loja (Google Play + App Store); documentação de deploy; runbook de operação.

### 8.5 Demo planejada

> **"Navegar pelo app completo com Bottom Tabs: ver mapa com hospitais e geofences, lista de hospitais com indicadores, perfil com consentimentos. Testar ranking: ordenar por nota e por tempo, filtrar por tipo. Navegar com TalkBack ativado. Forçar erro de rede e ver EmptyState/ErrorState. Disparar 11 logins em 1 minuto e ver rate limit (429)."**

### 8.6 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Refatoração de navegação (Drawer → Tabs) quebrar fluxos existentes | Média | Alto | FE faz a migração em branch separada; testar todos os fluxos (login, cadastro, home, detalhe hospital, feedback) antes do merge; rollback possível se estourar prazo |
| Design System com inconsistências entre componentes | Média | Médio | QA faz varredura visual em todas as telas; checklist de componentes vs. Padrão UI/UX; Storybook ou catálogo de componentes para referência |
| Build de produção com erros (Expo EAS Build) | Média | Médio | DevOps gera build de produção no dia 1 do sprint para identificar problemas cedo; CI/CD configurado para builds automáticos |
| Acessibilidade subestimada (3 pts pode ser pouco) | Média | Médio | Foco em WCAG AA nível A (mínimo): labels, contraste, alvos; AA completo (nível AA) como stretch; auditoria com ferramenta automatizada (axe-core, Accessibility Scanner) |

### 8.7 Definição de Pronto (DoD) do sprint

- [x] Bottom Tabs funcional com 3 abas e navegação completa.
- [x] Design System v2.0 aplicado em 100% das telas.
- [x] Acessibilidade WCAG A verificada com ferramenta automatizada.
- [x] Estados de carregamento/vazio/erro em todas as telas.
- [x] Ranking funcional com ordenação e filtro.
- [x] Rate limiting ativo e testado.
- [x] Build de produção gerado e validado em device real.

---

## 9. Sprint a Sprint Detalhado (Tabela Consolidada)

### 9.1 Sprint S0 — Estabilização e Segurança 🔥

| Estória ID | Descrição Resumida | Pontos | Resp. | Dep. |
|---|---|---|---|---|
| F0-01 | Hash BCrypt — refatorar `AuthServiceImpl` para não gravar senha em claro | 3 | BE | — |
| F0-02 | JWT com Spring Security — access 15min + refresh 30d + SecureStore | 8 | BE + FE | F0-01 |
| F0-03 | Padronizar envelope de erro (timestamp, status, code, message pt-BR, traceId) | 2 | BE | — |
| F0-05 | Exclusão de conta LGPD — cascade de dados pessoais + anonimização de agregados | 5 | BE + FE | F0-02 |

**Objetivo do sprint:** Sistema seguro para exposição pública — senha com hash, JWT, erros padronizados, LGPD básico.

**Demo planejada:** Login com JWT → acessar endpoint protegido → token expirado → refresh → logout. Excluir conta e verificar remoção de dados.

**Riscos e mitigação:** Complexidade do Spring Security (spike 4h) · Cascade LGPD (soft delete como fallback).

---

### 9.2 Sprint S1 — Hospitais e Geofence Admin 🏥

| Estória ID | Descrição Resumida | Pontos | Resp. | Dep. |
|---|---|---|---|---|
| E1-01 | CRUD de hospital — nome, CNPJ, tipo, endereço, status | 5 | BE | S0 |
| E1-02 | Geofence como polígono GeoJSON — desenho no mapa + validação | 5 | BE + FE | E1-01 |
| E1-03 | Listagem pública de hospitais ativos com indicadores (placeholder) | 3 | BE + FE | E1-01 |
| E1-04 | Edição e desativação de hospital/geofence | 3 | BE + FE | E1-02 |

**Objetivo do sprint:** Cadastrar hospitais com áreas geográficas no mapa.

**Demo planejada:** Cadastrar 3 hospitais reais com geofences → listar no app público → buscar por nome → ver polígono no mapa.

**Riscos e mitigação:** Editor de polígono no RN limitado (fallback: admin web) · Validação GeoJSON complexa (JTS library).

---

### 9.3 Sprint S2 — Detecção de Visitas 📍

| Estória ID | Descrição Resumida | Pontos | Resp. | Dep. |
|---|---|---|---|---|
| E2-01 | Detecção automática de entrada — geofencing nativo + checkin API | 5 | FE + BE | S1 |
| E2-02 | Detecção automática de saída — checkout + `duracaoMinutos` | 5 | FE + BE | E2-01 |
| E2-06 | Check-in manual em 1 toque — caminho de primeira classe ao lado do automático (GPS desligado/negado) | 3 | FE + BE | S1 |
| E2-07 | Card de visita ativa com cronômetro — home + notificação persistente | 3 | FE | E2-01 |
| E2-09 | Heartbeat a cada 30 minutos — sinal de presença | 3 | FE + BE | E2-01 |

**Objetivo do sprint:** Detectar entrada/saída automática via geofencing nativo com heartbeat de presença.

**Demo planejada:** Caminhar até perímetro de hospital real → card aparece → cronômetro → sair → visita finalizada com duração correta.

**Riscos e mitigação:** Geofencing iOS imprevisível (testar device real dia 1) · Heartbeat consumo bateria (medir, ajustar intervalo se necessário).

---

### 9.4 Sprint S3 — Robustez de Visitas + Feedback Backend 🛡️

| Estória ID | Descrição Resumida | Pontos | Resp. | Dep. |
|---|---|---|---|---|
| E2-03 | Expiração de visitas — 24h sem heartbeat → `EXPIRADA` (job) | 5 | BE | S2 |
| E2-04 | Conflito de áreas sobrepostas — hospital mais próximo | 3 | BE | S2 |
| E2-05 | Recuperação de GPS interrompido — timeout 10min | 3 | FE + BE | S2 |
| E2-10 | Sinalização de internação/observação — prompt após 12h | 3 | FE + BE | S2 |
| E2-08 | Filtro de visitas < 2min nas estatísticas | 2 | BE | S2 |
| E3-04 | Bloqueio de feedback duplicado — unique index `visitaId` | 2 | BE | S2 |
| E3-05 | Feedback anônimo — sem login, `usuarioId` nulo | 3 | BE | E3-04 |

**Objetivo do sprint:** Visitas robustas contra falhas + backend de feedback com dedupe e anônimo.

**Demo planejada:** GPS preso → expiração. Geofences sobrepostos → escolha. Visita 13h → prompt internação. Feedback duplicado → rejeitado.

**Riscos e mitigação:** Falsos positivos na expiração (log detalhado, soft expiration) · Mediana sem operador MongoDB nativo (calcular em Java).

---

### 9.5 Sprint S4 — Feedback Mobile + Notificações 📝

| Estória ID | Descrição Resumida | Pontos | Resp. | Dep. |
|---|---|---|---|---|
| E3-01 | Notificação local de feedback — 1–5min após saída | 3 | FE | S3 |
| E3-02 | Formulário de feedback — 4 perguntas, pulável, chips, < 45s | 8 | FE | S3 |
| E3-03 | Janela de 24h para responder + 1 lembrete único | 3 | FE | S3 |
| E3-06 | Tela de agradecimento e impacto social | 2 | FE | E3-02 |

**Objetivo do sprint:** Experiência completa de feedback: notificação → formulário rápido → agradecimento.

**Demo planejada:** Ciclo completo — entrar → sair → notificação → formulário < 30s → agradecimento → hospital com N incrementado.

**Riscos e mitigação:** Formulário complexo estourar 8 pts (BE ocioso pode ajudar com componentes) · Notificação iOS falhar (fallback: abrir app manualmente).

---

### 9.6 Sprint S5 — Indicadores Públicos + Conta/Privacidade 📊

| Estória ID | Descrição Resumida | Pontos | Resp. | Dep. |
|---|---|---|---|---|
| E4-01 | Nota média do hospital — 1–5, últimos 90d, N ≥ 5 | 3 | BE + FE | S4 |
| E4-02 | Tempo médio — mediana, ≤ 24h, exclui internação/observação | 3 | BE + FE | S4 |
| E4-03 | Tela de detalhe público do hospital | 3 | FE | E4-01 |
| E4-04 | Atualização de agregados ≤ 15min após feedback | 3 | BE | S4 |
| E5-01 | Permissão de localização em etapas com explicação | 3 | FE | S2 |
| E5-02 | Aceite de termos e política de privacidade | 2 | FE | — |
| E5-04 | Cadastro/login opcional integrado ao fluxo | 3 | FE + BE | S0 |

**Objetivo do sprint:** Indicadores públicos por hospital + onboarding LGPD + conta opcional.

**Demo planejada:** Hospital com 12 avaliações: nota 4.2, tempo 1h35. Hospital com 3: "sem avaliações". Onboarding completo → pular cadastro → depois criar conta.

**Riscos e mitigação:** Onboarding com múltiplos estados (máquina de estados) · Performance da mediana com N grande (irrelevante no MVP, cache materializado).

---

### 9.7 Sprint S6 — Polimento e Lançamento ✨

| Estória ID | Descrição Resumida | Pontos | Resp. | Dep. |
|---|---|---|---|---|
| E6-01 | Bottom Tabs (Início, Hospitais, Mapa, Perfil) — substituir Drawer | 5 | FE | — |
| E6-02 | Design System v2.0 em todas as telas — tokens, componentes, remoção assets antigos | 5 | FE | — |
| E6-03 | Acessibilidade WCAG AA — leitor de tela, contraste, alvos 48dp | 3 | FE | E6-02 |
| E6-04 | Estados de carregamento/vazio/erro em todas as telas | 2 | FE | — |
| E4-05 | Ranking de hospitais — ordenável por nota e tempo | 3 | BE + FE | S5 |
| F0-04 | Rate limiting — login 10/min, endpoints públicos 60/min | 2 | BE | — |

**Objetivo do sprint:** Polimento visual, acessibilidade, ranking, rate limiting e preparação de lançamento.

**Demo planejada:** App completo com Bottom Tabs → ranking → teste com TalkBack → forçar erros de rede → rate limit (429).

**Riscos e mitigação:** Refatoração de navegação quebrar fluxos (branch separada, rollback possível) · Build de produção (CI/CD, gerar no dia 1).

---

## 10. Velocity e Estimativas

### 10.1 Distribuição de story points por sprint

| Sprint | Pontos | Estórias | Épicos cobertos | Foco |
|---|---|---|---|---|
| **S0** | 18 | 4 | Fase 0 | 🔥 Segurança |
| **S1** | 16 | 4 | E1 (parcial) | 🏥 Hospitais |
| **S2** | 19 | 5 | E2 (parcial) | 📍 Detecção de visitas |
| **S3** | 21 | 7 | E2 (final) + E3 (backend) | 🛡️ Robustez + Feedback BE |
| **S4** | 16 | 4 | E3 (mobile) | 📝 Feedback Mobile |
| **S5** | 20 | 7 | E4 + E5 (parcial) | 📊 Indicadores + Conta |
| **S6** | 20 | 6 | E6 + E4 (final) + F0 | ✨ Polimento |
| **Total** | **130** | **37*** | **6 épicos + Fase 0** | |

> \* 37 contagens de estória-sprint (31 estórias únicas; F0-04, E4-05 e outras aparecem em 1 sprint cada; as estórias não se repetem entre sprints).

### 10.2 Velocity planejado vs. ideal

```
Sprint:  S0      S1      S2      S3      S4      S5      S6
Pontos:  18      16      19      21      16      20      20
         ██████  █████   ██████  ██████  █████   ██████  ██████
Média:   18.6 pts/sprint (target: 18–20)  ✅ Dentro da faixa
```

**Análise:**
- **S1 e S4 são os sprints mais leves** (16 pts) — intencional: S1 é o primeiro sprint de produto, curva de aprendizado; S4 foca em UI/UX (FE intensivo).
- **S3 é o sprint mais pesado** (21 pts) — contém 7 estórias, mas muitas são pequenas (2–3 pts) e independentes entre si (BE pode paralelizar expiração, conflito, dedupe).
- **S0–S2 formam a "rampa de aceleração"**: segurança → dados → detecção. O time ganha contexto e velocidade sobe.
- **S5–S6 são sprints de "fechamento"**: funcionalidades visíveis para stakeholders, polimento.

### 10.3 Burndown ideal por sprint (story points)

```
Semana 1:   Semana 2:
 ████████    ████████      S0 (18 pts)
 ███████     █████████     S1 (16 pts)
 █████████   ██████████    S2 (19 pts)
 ██████████  ███████████   S3 (21 pts)
 ███████     █████████     S4 (16 pts)
 █████████   ███████████   S5 (20 pts)
 █████████   ███████████   S6 (20 pts)
```

### 10.4 Estimativa de esforço por perfil (horas/sprint)

| Perfil | Alocação | Horas/sprint (80h) | Atividades principais |
|---|---|---|---|
| **Backend (BE)** | 100% | ~70h dev + 10h cerimônias | API, modelos, geo queries, jobs, testes |
| **Frontend (FE)** | 100% | ~70h dev + 10h cerimônias | Telas, geofencing, notificações, Design System |
| **DevOps/QA** | 100% | ~40h QA + 20h infra + 10h cerimônias + 10h buffer | Testes manuais/automáticos, CI/CD, ambiente, build |

---

## 11. Matriz de Riscos por Sprint

### 11.1 Riscos técnicos (mapeados da Árvore Tecnológica)

| # | Risco | S0 | S1 | S2 | S3 | S4 | S5 | S6 | Prob. | Impacto | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Precisão do geofence em área urbana densa | | | 🔴 | 🟡 | 🟢 | | | Alta | Médio | Mitigado (teste campo S3→S4) |
| T2 | Restrições iOS de localização em background | | | 🔴 | 🟡 | 🟢 | | | Alta | Alto | Mitigado (geofencing nativo) |
| T3 | Senha em texto puro — dívida de segurança | 🔴 | 🟢 | | | | | | — | Crítico | ✅ Resolvido no S0 |
| T4 | Volume de escrita de posição no MongoDB | | | | | 🟡 | 🟡 | 🟢 | Média | Médio | Monitorar |
| T5 | Dependência de bibliotecas RN de terceiros | | | 🟡 | 🟡 | 🟡 | | | Baixa | Médio | Acompanhar releases |

> Legenda: 🔴 = risco ativo · 🟡 = risco parcialmente mitigado · 🟢 = risco controlado

### 11.2 Riscos de produto (mapeados do Documento Negocial)

| # | Risco | S0 | S1 | S2 | S3 | S4 | S5 | S6 | Prob. | Impacto | Mitigação |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | Baixa taxa de resposta ao feedback | | | | | 🟡 | 🟡 | 🟡 | Média | Alto | Formulário curto, notificação timing, anônimo |
| R2 | GPS impreciso / bateria | | | 🔴 | 🟡 | 🟢 | | | Média | Médio | Geofencing nativo, teste campo |
| R3 | Avaliações fraudulentas | | | | 🟡 | 🟡 | 🟡 | 🟡 | Média | Alto | 1 feedback/visita, N mínimo, padrões |
| R4 | Poucos hospitais com N ≥ 5 | | | | | | 🔴 | 🟡 | Alta | Médio | Comunicação clara, foco em densidade |
| R5 | LGPD / privacidade | 🟡 | 🟢 | | | | 🟡 | 🟢 | Média | Alto | Consentimento granular, DPO |
| R6 | Permissão localização background (iOS) | | | 🔴 | 🟡 | 🟢 | | | Alta | Médio | Geofencing nativo, fallback manual |
| R7 | Visita "presa" em esperas longas (12h+ SUS) | | | 🔴 | 🟡 | 🟢 | | | Média | Alto | Heartbeat (S2), expiração 24h (S3), sinalização internação (S3) |

### 11.3 Riscos de gestão

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Time de 3 pessoas é frágil (baixa resiliência a ausências) | Média | Alto | Documentação em cada sprint; pair programming em estórias críticas; buffer de 2 semanas no plano |
| Escopo crescer durante o desenvolvimento (scope creep) | Média | Alto | PO é o gatekeeper; mudanças de escopo via cerimônia de refinamento; backlog futuro (FUT-01..07) documentado para capturar ideias sem poluir MVP |
| Dependência de dispositivo físico iOS para testes | Baixa | Médio | Adquirir/emprestar device iOS até S2; Expo EAS Build com TestFlight para beta testers |
| Teste de campo de geofence inviável (logística) | Média | Alto | Agendar 3 hospitais até S2; se inviável, simular com GPX traces de visitas reais (dados anonimizados de voluntários) |

---

## 12. Plano de Comunicação

### 12.1 Canais e Frequência

| Canal | Público | Frequência | Responsável | Conteúdo |
|---|---|---|---|---|
| **Daily Scrum** (15min) | Time | Diário | Time (rodízio) | O que fiz, o que farei, impedimentos |
| **Sprint Review** (1h) | Time + Stakeholders | Fim de cada sprint | PO / SM | Demo do incremento, feedback, ajuste de backlog |
| **Sprint Retro** (1h) | Time | Fim de cada sprint | SM | O que funcionou, o que melhorar, ações |
| **Backlog Refinement** (1h) | Time + PO | Meio de cada sprint | PO | Refinar estórias dos próximos 2 sprints, estimar |
| **Status Report** (assíncrono) | Stakeholders | Semanal (sexta) | SM | 1-pager: progresso vs plano, riscos, blockers, asks |
| **Slack/Teams #saude-monitor** | Time | Contínuo | Todos | Comunicação assíncrona, blockers, decisões rápidas |
| **Canal #stakeholders** | Stakeholders | Sob demanda | PO | Atualizações de produto, demos agendadas |

### 12.2 Comunicação de riscos e impedimentos

- **Impedimento de time**: reportado na Daily; se não resolvido em 24h, SM escala.
- **Risco materializado**: SM notifica PO e stakeholders no Status Report semanal; inclui probabilidade atualizada e ação.
- **Mudança de escopo**: PO avalia impacto; se afeta sprint goal, discutido em Planning extraordinária; registrado no backlog.
- **Blocker técnico**: DevOps/QA cria ticket no board; SM acompanha diariamente.

### 12.3 Marcos de comunicação com stakeholders

| Marco | Quando | O que comunicar |
|---|---|---|
| **Kickoff do MVP** | Início do S0 | Apresentação do plano de sprints, roadmap, riscos |
| **Demo de segurança** | Fim do S0 | JWT funcional, senha hash, erros padronizados |
| **Demo de hospitais no mapa** | Fim do S1 | Geofences desenhados, lista pública funcional |
| **Demo de detecção automática** | Fim do S2 | Ciclo completo de visita com geofencing nativo |
| **Demo de feedback** | Fim do S4 | Formulário completo, notificação, agradecimento |
| **Demo de indicadores públicos** | Fim do S5 | Nota, tempo, N na tela do hospital |
| **Demo de lançamento** | Fim do S6 | App completo, build de produção, loja |
| **Lançamento** | S6+2 (buffer) | App publicado, campanha de aquisição |

---

## 13. Cerimônias e Cadência

### 13.1 Calendário semanal (timebox rígido)

| Dia | Cerimônia | Duração | Horário sugerido | Participantes |
|---|---|---|---|---|
| **Seg–Sex** | Daily Scrum | 15 min | 09:15 | Time completo |
| **Quarta (meio sprint)** | Backlog Refinement | 1 h | 14:00 | Time + PO |
| **Sexta (fim sprint)** | Sprint Review | 1 h | 10:00 | Time + PO + Stakeholders |
| **Sexta (fim sprint)** | Sprint Retrospective | 1 h | 11:15 | Time (sem stakeholders) |
| **Segunda (início sprint)** | Sprint Planning | 2 h | 09:30 | Time + PO |

### 13.2 Regras das cerimônias

- **Daily Scrum**: 15 minutos máximos. Se passar de 15min, o SM encerra e os interessados continuam em conversa separada. Formato: cada pessoa responde 3 perguntas (fez, fará, impedimentos). SM anota blockers no board.
- **Sprint Planning (2h)**: 
  - Primeira hora: PO apresenta objetivo do sprint e estórias priorizadas (o quê).
  - Segunda hora: time estima, detalha tarefas e confirma capacidade (como).
  - Output: Sprint Goal (1 frase) + Sprint Backlog (estórias comprometidas).
- **Sprint Review (1h)**: Demo do incremento funcional em device real/ambiente de staging. Nada de slides — apenas o produto funcionando. Stakeholders dão feedback; PO atualiza backlog se necessário.
- **Sprint Retrospective (1h)**: Time apenas. Formato variável (4Ls, Start-Stop-Continue, Sailboat). Output: no máximo 3 ações com owner e data. Ações do retro anterior são revisadas nos primeiros 5 minutos.
- **Backlog Refinement (1h)**: PO apresenta estórias dos próximos 2 sprints; time discute, estima e levanta dúvidas. Estórias que não atingirem Definition of Ready voltam para o PO refinar.

### 13.3 Exceções e adaptações

- **Planning extraordinária**: apenas se o Sprint Goal for invalidado (ex.: blocker crítico). Timebox de 1h.
- **Daily async**: se o time estiver em trabalho de campo (teste de geofence S3→S4), Daily pode ser assíncrona via Slack (thread dedicada).
- **Retro maior**: a cada 3 sprints (S3 e S6), considerar retro estendida de 90min para temas mais profundos (saúde do time, dívida técnica, processo).

---

## 14. Métricas de Acompanhamento (Beyond Product KPIs)

Além dos KPIs de produto definidos no Documento Negocial (taxa de resposta, N hospitais, WAUs), o time acompanha métricas de processo:

### 14.1 Métricas de entrega

| Métrica | Definição | Meta | Frequência |
|---|---|---|---|
| **Say/Do ratio** | Story points entregues ÷ story points comprometidos no sprint | ≥ 80% | Por sprint |
| **Velocity** | Média móvel de story points entregues (últimos 3 sprints) | 18–20 pts | Por sprint |
| **Sprint Goal atingido** | % de sprints em que o objetivo foi cumprido | ≥ 85% (5 de 6 sprints S1–S6) | Por sprint |
| **Cycle time** | Tempo médio entre "In Progress" e "Done" de uma estória | ≤ 5 dias úteis | Por sprint |
| **Throughput** | Número de estórias entregues por sprint | 4–7 | Por sprint |

### 14.2 Métricas de qualidade

| Métrica | Definição | Meta | Frequência |
|---|---|---|---|
| **Escaped defects** | Bugs reportados em produção por sprint pós-lançamento | ≤ 3 | Por sprint (pós-S6) |
| **Cobertura de testes** | % de linhas cobertas por testes unitários nos serviços críticos | ≥ 70% | Por sprint |
| **Retro action completion** | % de ações do retro anterior concluídas até o fim do sprint | ≥ 80% | Por sprint |
| **Build stability** | % de builds de CI verdes (sem falha) | ≥ 90% | Por sprint |
| **Code review time** | Tempo médio entre abertura do PR e merge | ≤ 24h | Por sprint |

### 14.3 Métricas de saúde do time

| Métrica | Definição | Alerta se | Frequência |
|---|---|---|---|
| **WIP (Work in Progress)** | Número de estórias simultaneamente em progresso | > 5 (para time de 3) | Diário (Daily) |
| **Blocker age** | Tempo desde que o blocker foi reportado | > 48h sem resolução | Diário |
| **Sprint scope change** | % de story points adicionados/removidos durante o sprint | > 15% do comprometido | Fim do sprint |
| **Horas extras** | Horas trabalhadas além das 40h/semana | > 5h/semana consistente | Retro |

### 14.4 Dashboard de acompanhamento (exemplo)

```
┌─────────────────────────────────────────────────────────┐
│ 🏃 CLINICAL SANCTUARY — SPRINT STATUS          S3 Day 7 │
├─────────────────────────────────────────────────────────┤
│ Sprint Goal: Robustez de visitas + Feedback Backend      │
│ Progress:     ████████░░░░░░░░  53% (11/21 pts)         │
│ Burndown:     -2 pts vs ideal (recuperável)              │
│                                                         │
│ Em progresso:  4 estórias (WIP: 4/5 ⚠️)                 │
│ Bloqueado:     1 (IMP-07 — device iOS para teste GPS)    │
│ Escopo:        sem mudanças (0 pts adicionados)          │
│                                                         │
│ Próx. marco:   Demo S3 em 4 dias                         │
│ Risco ativo:   Job de expiração com falsos positivos 🟡  │
└─────────────────────────────────────────────────────────┘
```

---

## 15. Plano de Testes

### 15.1 Níveis de teste por sprint

| Sprint | Testes unitários | Testes de integração | Testes de UI | Testes de campo |
|---|---|---|---|---|
| **S0** | Auth, BCrypt, erro | Login/logout/refresh, exclusão LGPD | — | — |
| **S1** | Validação GeoJSON, CRUD | CRUD hospital, listagem, $geoIntersects | Formulário hospital | — |
| **S2** | Checkin/checkout, heartbeat | Ciclo visita completo | Card visita, check-in manual | — |
| **S3** | Expiração, conflito, dedupe | Job expiração, feedback duplicado | Prompt internação | 🟡 **Teste campo geofence (3 hospitais)** |
| **S4** | — | Envio feedback | Formulário, notificação, acessibilidade | — |
| **S5** | Agregação, mediana | Indicadores, N ≥ 5, atualização | Onboarding, detalhe hospital | — |
| **S6** | Rate limiting | Ranking, rate limit 429 | Bottom Tabs, Design System, acessib. | 🟢 Smoke test geral |

### 15.2 Teste de campo de geofence (entre S3 e S4)

> **CRÍTICO**: O teste de campo valida as premissas de geofencing que sustentam todo o produto.

| Parâmetro | Valor |
|---|---|
| **Hospitais** | ≥ 3 (público grande, público médio, privado) |
| **Duração** | 2–3 dias por hospital |
| **Cenários** | Entrada normal, saída normal, saída curta (< 5min), espera longa (> 2h), GPS desligado/retomado, check-in manual |
| **Métricas coletadas** | Latência de detecção de entrada (ideal ≤ 3min), latência de saída (ideal ≤ 7min), falsos positivos/dia, consumo de bateria (%/dia) |
| **Critério de sucesso** | Precisão ≥ 80% nas detecções; bateria < 5%/dia; zero falsos positivos em espera longa |
| **Responsável** | QA + FE (acompanhamento presencial) |

---

## 16. Preparação para Lançamento (S6+)

### 16.1 Atividades pós-S6 (buffer de 2 semanas)

| Atividade | Responsável | Prazo |
|---|---|---|
| Teste de regressão completo (todas as funcionalidades) | QA | Semana 1 |
| Teste de carga (100 usuários simulados) | DevOps | Semana 1 |
| Correção de bugs críticos encontrados | Time | Semana 1–2 |
| Deploy de produção (API + MongoDB Atlas) | DevOps | Semana 2 |
| Submissão às lojas (Google Play + App Store) | FE + DevOps | Semana 2 |
| Configuração de monitoramento (Prometheus + Grafana + alertas) | DevOps | Semana 2 |
| Documentação de operação (runbook) | DevOps + BE | Semana 2 |
| Comunicação de lançamento (press release, redes sociais) | PO | Semana 2 |

### 16.2 Critérios de Go/No-Go para lançamento

- [x] Teste de regressão 100% aprovado (zero bugs P0/P1 abertos).
- [x] Teste de campo de geofence aprovado (precisão ≥ 80%).
- [x] KPIs de produto instrumentados e funcionais.
- [x] Build de produção aprovado em device real (Android + iOS).
- [x] Review de segurança concluído (OWASP Top 10, sem vulnerabilidades críticas).
- [x] Documentação LGPD finalizada (DPO aprovou).
- [x] Runbook de operação testado (deploy, rollback, restore backup).
- [x] Termos de uso e política de privacidade publicados.

---

## 17. Backlog Futuro (pós-MVP)

Para referência, as estórias que estão fora do MVP mas documentadas para a Fase 2:

| ID | Estória | Fase | Dependência |
|---|---|---|---|
| FUT-01 | Painel institucional para gestores (agregados + alertas de queda de nota) | Fase 2 | E4 (agregados) |
| FUT-02 | Integração com sistemas internos de hospitais via API | Fase 2 | Parceria hospitalar |
| FUT-03 | Relatórios agregados para poder público | Fase 3 | FUT-01 |
| FUT-04 | Busca avançada com filtros (tipo, região, especialidade) | Fase 2 | E4-05 |
| FUT-05 | Comparação lado a lado de 2+ hospitais | Fase 2 | E4-01 |
| FUT-06 | Modo escuro e personalização de notificações | Fase 2 | E6-02 (Design System) |
| FUT-07 | Teleconsulta e pagamentos (visão v1.0 SAS) | Fase 3 | Roadmap estratégico |

---

## 18. Glossário do Plano de Sprints

| Termo | Definição |
|---|---|
| **Sprint Goal** | Objetivo único e mensurável do sprint — se o escopo precisar ser cortado, preserva-se o goal. |
| **Velocity** | Média de story points entregues por sprint (últimos 3 sprints). |
| **Story Point** | Unidade relativa de esforço (Fibonacci: 1, 2, 3, 5, 8, 13) — considera complexidade, incerteza e volume. |
| **DoR (Definition of Ready)** | Critérios que uma estória deve atender para entrar no sprint (critérios de aceite claros, dependências mapeadas, estimada). |
| **DoD (Definition of Done)** | Critérios que um incremento deve atender para ser considerado pronto (testado, revisado, documentado, integrável). |
| **Say/Do Ratio** | % de story points entregues vs comprometidos — mede previsibilidade. |
| **Cycle Time** | Tempo entre o início e a conclusão de uma estória (ideal ≤ 5 dias). |
| **WIP** | Work in Progress — número de estórias em andamento simultâneo (limite: 5 para time de 3). |
| **Spike** | Investigação timeboxada (ex.: 4h) para reduzir incerteza técnica antes de comprometer uma estória. |
| **Stretch goal** | Estória desejável mas não comprometida — só é puxada se o sprint goal já estiver garantido. |

---

## 19. Assinaturas e Aprovações

| Papel | Nome | Data | Assinatura |
|---|---|---|---|
| **Product Owner** | Gabriel Vogado | 07/08/2026 | Proposta inicial |
| **Scrum Master** | Gabriel Vogado | 07/08/2026 | Proposta inicial |
| **Tech Lead / Backend** | _A definir_ | | |
| **Frontend** | _A definir_ | | |
| **DevOps/QA** | _A definir_ | | |

> **Status:** Proposta de plano de sprints — validar e ajustar com o time completo durante a Planning do Sprint 0. Estimativas de story points são sugestivas e devem ser recalibradas pelo time.

---

## 20. Sprint S7 — Painel Administrativo Web (Frente Paralela) 🖥️ · ⏸️ **ADIADA**

> ⏸️ **Situação em 02/09/2026: esta sprint não foi executada e está adiada por decisão do Product Owner.**
>
> Registro literal: *"O Painel ADMIN ainda não é prioritário, será desenvolvido depois que o app estiver todo desenvolvido sem pendências, nem débitos técnicos."*
>
> **Condição de entrada (cumulativa):** S9, S10, S11 e S12 concluídas — isto é, desempenho corrigido, débitos técnicos zerados e validações V-01..V-09 aprovadas. Enquanto isso não ocorrer, a gestão administrativa segue pelos endpoints REST protegidos por `ADMIN` e pelas telas legadas de moderação no app. O conteúdo abaixo permanece **válido como planejamento**, apenas fora do caminho crítico.

> **2 sprints (~4 semanas) · 25 story points · Depende de: S1 concluído (backend de `hospitais` e `hospitais/sugestoes` disponível) · Conduzida em paralelo às sprints S2–S6, por não impactar o cronograma do app mobile**

### 20.1 Objetivo do sprint

> **"Entregar uma aplicação web dedicada ao administrador — fora do app mobile da população — para listar, filtrar, visualizar em mapa multi-camada (Regiões Administrativas, RIDE, Regiões de Saúde, Macrorregiões de Saúde) e gerenciar (editar/desativar) hospitais, reaproveitando a API já construída em S1, sem qualquer acesso de escrita a dados de feedback."**

### 20.2 Estórias do sprint (Épico 7)

| ID | Prioridade | Estória | Pontos | Resp. | Tipo |
|---|---|---|---|---|---|
| E7-01 | P0 | Login web administrativo (papel `ADMIN`) | 3 | FE Web | ➕ Nova |
| E7-02 | P0 | Listar todos os hospitais (ativos e inativos) | 3 | FE Web | ➕ Nova |
| E7-03 | P0 | Filtrar hospitais (nome, tipo, status, região) | 3 | FE Web | ➕ Nova |
| E7-04 | P0 | Mapa com 4 camadas georreferenciadas | 8 | FE Web + BE | ➕ Nova |
| E7-05 | P0 | Detalhe do hospital ao clicar no pin/lista | 2 | FE Web | ➕ Nova |
| E7-06 | P0 | Editar hospital (reaproveita contrato de E1-04) | 2 | FE Web | ➕ Nova |
| E7-07 | P0 | Desativar hospital com ícone cinza | 2 | FE Web | ➕ Nova |
| E7-08 | P0 | Bloqueio de escrita sobre feedback | 1 | BE + FE Web | ➕ Nova |
| E7-09 | P1 | Menu Hospitais / Mapa / Sugestões pendentes | 1 | FE Web | ➕ Nova |

### 20.3 Entregáveis esperados

- [ ] Aplicação web nova, publicada em ambiente próprio, autenticando via papel `ADMIN`.
- [ ] Shapefiles de `D:\saude-monitor\multiplas_camadas_saude_14` convertidos para GeoJSON e servidos pelo backend como 4 camadas independentes.
- [ ] Listagem e mapa de hospitais com filtros combináveis (nome, tipo, status, região).
- [ ] Fluxo completo de detalhe → editar/desativar, com ícone cinza para inativo.
- [ ] Fila de moderação de sugestões (E1-06/F-10) migrada do app mobile para este painel.
- [ ] Nenhuma tela ou endpoint do painel permite escrever em dados de feedback.

### 20.4 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Peso dos GeoJSON de macrorregiões degradar performance do mapa | Média | Médio | Simplificação de geometria (mapshaper/topojson) antes de servir; cache no backend |
| Divergência de nomenclatura de região entre camadas | Média | Baixo | Normalização no processo de importação, com relatório de auditoria (padrão de `07-dados/`) |
| Equipe também alocada nas sprints S2–S6 (contenção de recurso) | Média | Médio | Tratado como frente paralela com recurso dedicado (ex.: FE Web) para não competir com o time mobile |

### 20.5 Referências

- Backlog: `04-backlog/Backlog-MVP-v2.0.md` — Épico 7 (E7-01..E7-09)
- Feature: `05-features/Features-MVP-v2.0.md` — F-11
- Plano técnico (stack, pastas, consumo de API): `02-arquitetura-tecnica/Plano-Tecnico-Painel-Administrativo-Web-v1.0.md`

---

## 21. Sprint S8 — Pendências / Stretch 🧹 · ✅ **CONCLUÍDA (01/09/2026)**

> ✅ **Entregue integralmente.** As cinco estórias foram implementadas em branches por estória e mergeadas em `develop` pelos PRs **#48 a #52** (`develop@f26666e`). Suíte do frontend verde (24 suítes, 166 testes) e do backend verde (118 testes).
>
> **Duas correções de escopo que este plano descrevia de forma diferente do que foi executado** — registradas aqui porque o texto original abaixo permanece como estava e induziria a erro:
>
> | O plano dizia | O que foi entregue | Por quê |
> |---|---|---|
> | Exportação de dados (E5-03) em **CSV** | Exportação em **PDF** (`GET /api/v1/contas/export/pdf`, OpenPDF), além do JSON já existente | Decisão do Product Owner: um PDF é legível por qualquer cidadão; um CSV pressupõe planilha e alfabetização de dados. O direito do art. 18 da LGPD só é efetivo se a pessoa conseguir ler o que recebeu |
> | Mapa e polígonos em **`react-native-maps`** | **`@maplibre/maplibre-react-native`** | Biblioteca open source, sem exigência de chave de API do Google. **Todas as menções a `react-native-maps` neste documento (incluindo §3.4 e §21.6) são históricas e não descrevem o código atual** |
>
> **Pendência herdada:** o item de DoD "suíte de testes frontend 100% verde" (§21.5) foi verificado **localmente**, não na esteira — o job de frontend do `ci.yml` roda `npm run typecheck` e `npx expo export`, mas **não roda `npm test`**. Some-se que o `typecheck` não verifica o código (`checkJs: false` sobre um projeto 100% `.js`). Corrigido em **E8-12/E8-13** (S10).

> **2 semanas · 15 story points · Depende de: S6 concluído · Não inclui o Painel Admin (Sprint S7, seção 20) nem Épico 7/F-11**

### 21.1 Contexto

Após a conclusão das 7 sprints (S0–S6) e com o Painel Administrativo Web tratado como frente paralela (Sprint S7, seção 20), restou um conjunto de estórias **stretch / parcialmente cobertas** que não entraram no escopo prioritário das 7 sprints. Esta **Sprint S8** consolida essas pendências em uma entrega única para fechar o MVP mobile.

### 21.2 Estórias do sprint

| ID | Prioridade | Estória | Pontos | Resp. | Tipo | Status base |
|---|---|---|---|---|---|---|
| **E4-05 (UI)** | P0 | Ranking de hospitais — UI de ordenação por nota e tempo consumindo `GET /api/v1/hospitais/ranking` (backend já na develop) | 3 | FE | ➕ Nova | Backend pronto (PR #27) |
| **F-07** | P0 | Mapa renderizando os polígonos/geofences dos hospitais + filtro geo (raio) consumindo `GET /api/v1/hospitais` — integração com navegação **4 abas** (Início, Hospitais, Mapa, Perfil); polígonos dos geofences renderizados no `react-native-maps`; filtro por raio; previously marked as "refatorar" status now aligned com a arquitetura 4-tab.
| **E5-03** | P1 | Histórico pessoal de visitas e feedbacks do usuário logado + exportação de dados (LGPD) | 3 | FE + BE | ➕ Nova | Stretch adiado da S6 |
| **E5-05** | P1 | Revogação nativa completa do consentimento de geolocalização (além do Perfil, também desligamento no SO) | 2 | FE | ➕ Nova | Parcial (Perfil + SO manual) |
| **E6-05** | P1 | Tela dedicada de permissão/opt-in de notificações (independente do fluxo de feedback E3) | 2 | FE | ➕ Nova | Parcial (via fluxo E3) |

### 21.3 Objetivo do sprint

> **"Fechar as pendências do MVP mobile: tornar o mapa completo (hospitais + geofences + filtro geo), entregar a UI do ranking e os itens de privacidade/histórico/notificações que ficaram como stretch nas 7 sprints, com a navegação **4 abas** (Início, Hospitais, Mapa, Perfil) já estabelecida a partir da S6."**

### 21.4 Entregáveis esperados

- [ ] **UI do ranking (E4-05)**: lista de hospitais ordenável por nota e tempo, com filtro por tipo (público/privado) e paginação; tela dedicada consumindo o endpoint já mergeado.
- [ ] **Mapa completo (F-07)**: polígonos das geofences dos hospitais renderizados no mapa; filtro por raio consumindo `GET /api/v1/hospitais`; integração visual da listagem no mapa; agora alinhado à **4 abas** (Início, Hospitais, Mapa, Perfil).
- [ ] **Histórico + exportação (E5-03)**: tela no Perfil listando visitas e feedbacks do usuário logado; botão de exportação (CSV) atendendo ao direito de portabilidade LGPD.
- [ ] **Revogação nativa completa (E5-05)**: revogar consentimento de localização no app e, quando aplicável, encaminhar para as configurações nativas do SO.
- [ ] **Notificações opt-in (E6-05)**: tela dedicada de permissão de notificações, desacoplada do fluxo de feedback.

### 21.5 DoD do sprint

- [ ] Todos os endpoints consumidos estão na develop (E4-05 ranking) ou são criados nesta sprint.
- [ ] Mapas renderizando geofences dos hospitais + filtro geo funcional — integrados à **4 abas** (Início, Hospitais, Mapa, Perfil).
- [ ] Ranking ordenável por nota/tempo com filtro.
- [ ] Histórico + exportação LGPD funcionais na aba Perfil.
- [ ] Revogação de localização completa (app + SO).
- [ ] Notificações com opt-in dedicado.
- [ ] Suíte de testes frontend 100% verde + typecheck sem erros.

### 21.6 Riscos do sprint

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Renderização de muitos polígonos degradar performance do mapa mobile | Média | Médio | Simplificar geometria; carregar hospitais do raio em vez de todos; `react-native-maps` com polygon leve |
| Exportação de dados (E5-03) com volume grande | Baixa | Baixo | Paginar/limitar e exportar assíncrono (job) se necessário |
| Revogação nativa no SO com comportamento variável (Android x iOS) | Média | Médio | Usar `Linking.openSettings` para encaminhar às configurações; documentar comportamento por SO |

---

## 22. Sprints S9–S12 — Do código entregue ao lançamento (acrescentado na v2.1)

> **Por que esta seção existe.** O plano v2.0 terminava em "S6 — Polimento e Lançamento", tratando o lançamento como consequência automática do fim do desenvolvimento. O desenvolvimento terminou (42 de 43 estórias do app) e o lançamento não ficou mais perto: o sistema está lento a ponto de impedir os próprios testes de campo que o §15 exige, e 5 dos 7 critérios de DoD do MVP não são atendidos. Estas quatro sprints cobrem essa distância. As estórias estão detalhadas no **Épico 8** do `Backlog-MVP-v2.1.md`.

---

### 22.1 Sprint S9 — Desempenho e Estabilização 🩺

> **2 semanas · P0 absoluto · Bloqueia todas as sprints seguintes**

#### Objetivo

> **"Tornar o sistema utilizável. Nenhuma tela deve fazer o usuário esperar sem explicação, e a primeira abertura do dia não pode falhar."**

#### Diagnóstico que originou a sprint

Medição direta contra `https://saude-monitor.onrender.com` em 02/09/2026:

| Requisição | TTFB | Leitura |
|---|---|---|
| `GET /actuator/health` — 1ª após ociosidade | **109,1 s** · HTTP **503** | *Cold start*: o plano `free` do Render suspende o serviço após ~15 min sem tráfego |
| `GET /actuator/health` — serviço quente | **2,5 – 3,2 s** | Um health check não consulta dados de negócio; a latência é da instância, não da consulta |
| `GET /api/v1/hospitais?page=0&size=20` | **1,9 – 4,9 s** · 35 KB | Payload inclui o polígono da geofence de cada hospital |
| `POST /api/v1/auth/login` — payload inválido (400, sem acesso ao banco) | **1,0 s** | Piso de latência por requisição, só pipeline HTTP |

**Conclusão:** a lentidão relatada em login, lista, cadastro e envio de feedback tem **uma causa comum** — a instância do backend no plano `free` (fração de vCPU compartilhada + *spin-down*). Não são quatro problemas de quatro telas. Otimizar renderização, memoização ou virtualização de lista no aplicativo **não resolve nenhum dos quatro sintomas**, e fazê-lo antes de corrigir a infraestrutura consome sprint sem mover o indicador.

#### Estórias

| ID | Prioridade | Estória | Pontos | Resp. |
|---|---|---|---|---|
| E8-01 | P0 | Eliminar o *cold start* na primeira abertura | 3 | Infra |
| E8-02 | P0 | Cumprir o orçamento de latência do RNF-02 (p95 < 300 ms) | 5 | BE |
| E8-03 | P0 | Enxugar o payload da listagem (geofence sob demanda) | 3 | BE + FE |
| E8-04 | P0 | Timeout explícito, estado de carregamento e erro acionável | 3 | FE |
| E8-05 | P0 | Inventário e correção dos bugs observados em uso | 5 | Time |
| E8-12 | P0 | CI executando `npm test` no frontend | 1 | Infra |
| | | **Total** | **20** | |

#### Entregáveis

- [ ] Primeira requisição após ≥ 30 min de ociosidade responde **< 5 s**, **sem 5xx**, com medição antes/depois registrada.
- [ ] p95 de `GET /hospitais` e `GET /hospitais/{id}/indicadores` **< 300 ms** com o serviço quente.
- [ ] `GET /hospitais` deixa de trafegar o polígono da geofence; o mapa e o detalhe o buscam sob demanda.
- [ ] Toda chamada de rede do app tem timeout; acima de 2 s exibe carregamento; falha exibe mensagem acionável que distingue "sem internet" de "servidor indisponível".
- [ ] Inventário de bugs fechado, com passos de reprodução e severidade; **todos os P0 corrigidos**.
- [ ] `ci.yml` executa `npm test` e bloqueia PR com teste falhando.

#### Decisão necessária no início da sprint

O `render.yaml` declara `plan: free` para o serviço `saude-monitor-backend-dev`. Há três caminhos, e **um deles não resolve**:

| Opção | Resolve o *cold start* | Resolve a latência quente | Custo |
|---|---|---|---|
| (a) Plano pago sem *spin-down* | ✅ | ✅ (CPU dedicada) | Mensalidade |
| (b) *Keep-alive* agendado batendo em `/actuator/health` | ✅ | ❌ — a CPU continua compartilhada, o piso de ~1 s por requisição permanece | ~zero |
| (c) Migrar de provedor | ✅ | ✅ | Esforço de migração |

**Recomendação:** (a) para o ambiente que receberá os testes de campo. A opção (b) é aceitável apenas como paliativo imediato enquanto (a) não é aprovada, e **não deve ser confundida com solução** — ela remove os 109 s, mas mantém os 1–5 s por requisição, que sozinhos já violam o RNF-02 e continuam tornando o app desagradável.

#### Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Custo de infraestrutura não aprovado | Média | **Alto** — sem isso o lançamento não acontece | Apresentar a medição desta seção como evidência; usar (b) como ponte, com prazo |
| Latência do MongoDB (host externo) ser parte relevante do problema | Média | Médio | Medir separadamente com E8-06 antes de concluir que a causa é só a CPU do Render |
| Inventário de bugs revelar defeitos funcionais além dos de desempenho | **Alta** | Médio | Reservar folga na sprint; bugs P1/P2 podem ir para S10 |

---

### 22.2 Sprint S10 — Qualidade e Observabilidade 🔬

> **2 semanas · Objetivo: poder confiar no que se mede**

#### Objetivo

> **"Fechar os critérios de DoD que nunca foram cumpridos e instrumentar o sistema, para que a próxima regressão apareça em painel e não em relato."**

#### Estórias

| ID | Prioridade | Estória | Pontos | Resp. |
|---|---|---|---|---|
| E8-06 | P1 | Métricas de latência e taxa de erro por endpoint | 3 | BE + Infra |
| E8-07 | P1 | *Crash reporting* no app | 2 | FE |
| E8-08 | P1 | Medição de cobertura de testes (DoD ≥ 70%) | 3 | Time |
| E8-09 | P1 | Contrato OpenAPI publicado | 2 | BE |
| E8-10 | P1 | Testes de integração com contexto Spring real | 5 | BE |
| E8-13 | P1 | *Lint* no frontend | 2 | FE |
| E8-14 | P1 | Encerrar as divergências de contrato | 2 | BE |
| | | **Total** | **19** | |

#### Entregáveis

- [ ] p50/p95/p99 e taxa de 5xx por endpoint visíveis em painel, com alerta ao estourar o RNF-02.
- [ ] *Crash* forçado no app aparece no painel em < 5 min, com *stack trace* e versão.
- [ ] Cobertura medida e publicada no CI em backend e frontend, com limiar que reprova o PR.
- [ ] OpenAPI servido pela aplicação, cobrindo os 31 endpoints REST.
- [ ] Fluxos críticos (auth, check-in/check-out, feedback, agregação) cobertos por teste de integração com contexto completo.
- [ ] `password`/`senha` e `users`/`usuarios` decididos e aplicados **nos dois lados** — código e `Especificacao-API`.

> **Nota sobre o `typecheck`:** a S8 usou `npm run typecheck` como critério de DoD nos cinco PRs. Esse gate **não verificava o código**: o `tsconfig.json` tem `checkJs: false` e o projeto não tem nenhum arquivo `.ts`/`.tsx`. O comando passava sempre. É por isso que E8-13 entra aqui — o substituto real é *lint*, não *typecheck*.

---

### 22.3 Sprint S11 — Validação Pré-Lançamento ✅

> **2 semanas · Executa o gate que o projeto definiu e nunca rodou**

#### Objetivo

> **"Executar as validações V-01 a V-08 do `Features-MVP-v2.1.md` §11 — inclusive o teste de campo de geofence em ≥ 3 hospitais reais, que é critério de DoD do MVP desde a primeira versão do backlog."**

#### Ordem de execução (não é arbitrária)

1. **V-03 (carga da API)** e **V-04 (penetração básico)** — primeiro, porque validam o resultado da S9/S10 em laboratório, antes de mobilizar pessoas em campo.
2. **V-01 (campo de geofence)**, **V-02 (bateria)** e **V-05 (compatibilidade)** — o teste de campo só faz sentido depois que a API responde dentro do orçamento; caso contrário, mede-se a infraestrutura e não a precisão do geofence.
3. **V-06 (usabilidade com pacientes reais)**, **V-07 (acessibilidade)** e **V-08 (revisão LGPD)**.

Acompanha a sprint a estória **E8-15** (retenção de dados, LGPD art. 16, e teste de restauração de *backup*), que é insumo de V-08.

#### Entregáveis

- [ ] V-01: 3 hospitais reais, 8 h cada; precisão de detecção ≥ 90%; falsos positivos ≤ 5%; **raio e tolerâncias recalibrados** com base no resultado (RN-01, RN-03, RN-23).
- [ ] V-02: consumo ≤ 5% de bateria em 8 h de monitoramento, Android e iOS.
- [ ] V-03: 100 req/s nos agregados, p95 < 300 ms, zero 5xx.
- [ ] V-04: senha nunca em texto puro, JWT expirado rejeitado, refresh revogado inutilizável, rate limit efetivo.
- [ ] V-05: matriz Android 8/10/13/14 + iOS 15/16/17.
- [ ] V-06: ≥ 10 usuários completam a jornada sem ajuda; feedback em < 45 s.
- [ ] V-07: WCAG 2.2 AA auditado por ferramenta **e** manualmente; ≥ 1 usuário com deficiência visual completa a jornada.
- [ ] V-08: consentimento, política de privacidade e fluxo de exclusão revisados por DPO ou consultor.

> **Riscos aceitos:** V-01 pode reprovar a calibragem atual do geofence e gerar trabalho não estimado em F-03. É o propósito do teste — é melhor descobrir com 3 hospitais do que com 1.000 usuários.

---

### 22.4 Sprint S12 — Beta Fechado 🚀

> **~4 semanas de operação (a sprint acompanha, não constrói)**

#### Objetivo

> **"Executar V-09: 30 dias de beta com ≥ 50 usuários reais, medindo o que até agora só foi estimado."**

#### Entregáveis

- [ ] Analytics de produto instrumentado (**E8-11**) — sem ele, o beta não produz os números que o justificam.
- [ ] Taxa de resposta de feedback ≥ 25%.
- [ ] Retenção D7 ≥ 30%.
- [ ] Correções decorrentes do beta priorizadas e tratadas.

#### Saída

Com V-09 aprovada, os 7 critérios de DoD do MVP fechados e zero débito técnico aberto, cumpre-se a condição de entrada do **Épico 7 / Painel Administrativo Web** — e a **S7 (§20) é retomada** como S13.

---

### 22.5 Linha do tempo consolidada

| Sprint | Foco | Situação |
|---|---|---|
| S0–S6 | MVP mobile | ✅ Concluídas |
| **S7** | Painel Administrativo Web | ⏸️ **Adiada** (decisão do PO, 02/09/2026) |
| S8 | Fechamento do escopo mobile | ✅ Concluída em 01/09/2026 |
| **S9** | **Desempenho e estabilização** | ⬜ **Próxima** |
| S10 | Qualidade e observabilidade | ⬜ Planejada |
| S11 | Validação pré-lançamento (V-01..V-08) | ⬜ Planejada |
| S12 | Beta fechado (V-09) | ⬜ Planejada |
| S13 | Painel Administrativo Web (retomada da S7) | ⬜ Condicionada a S9–S12 |
| *sem data* | E4-06 — tendência simples (P2) | ⬜ Não bloqueia lançamento |

---

*Fim do Plano de Sprints v2.1 — revisado em 02/09/2026. "Plans are worthless, but planning is everything." — Dwight D. Eisenhower*

