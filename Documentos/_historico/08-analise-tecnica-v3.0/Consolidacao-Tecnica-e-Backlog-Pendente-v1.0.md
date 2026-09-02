# Consolidação Técnica e Backlog Pendente — Saúde Monitor

| Campo | Valor |
|---|---|
| **Versão** | 1.0 |
| **Data** | 02/09/2026 |
| **Base de código auditada** | `develop@f26666e` (após o merge do PR #52 — Sprint S8 completa) |
| **Objetivo** | Unificar, em uma única fonte, tudo que está entregue, tudo que está pendente e tudo que os documentos existentes divergem entre si — para permitir a priorização subsequente |
| **Status** | Consolidação factual. **Nenhum item foi priorizado ainda** — a coluna "Prioridade sugerida" é proposta do autor, não decisão |

---

## 1. Documentos consolidados

| Documento | Versão / data | O que aporta | Defasagem detectada |
|---|---|---|---|
| `04-backlog/Backlog-MVP-v2.0.md` | v2.0 · 07/08/2026 | Fonte canônica de estórias (F0-01..05, E1..E7), prioridade MoSCoW, DoD do MVP, dependências | Sequência de sprints não reflete S7/S8 reais |
| `05-features/Features-MVP-v2.0.md` | v2.0 · 08/08/2026 | Features F-01..F-11, DoD por feature, roteiro de validação pré-lançamento (V-01..V-12), matriz de rastreabilidade | **Status de código congelado em 08/08** — descreve F-01, F-03 e F-06 como "Inexistente" quando estão funcionais |
| `05-features/Relatorio-Aderencia-Codigo-vs-Features.md` | v3.5 · 01/09/2026 | Aderência real código × feature | Atual |
| `06-sprints/Plano-Sprints-v2.0.md` | v2.0 | Sprints S0..S8 detalhadas, DoD por sprint, riscos | **Termina em S8** — não há planejamento pós-MVP |
| `De-Para-Backlog-Features.md` | 30/08/2026 | Mapeamento estória × feature × status | **Anterior à S8** — E4-05, E5-05, E6-05, E3-02 e E3-03 constam como parciais/pendentes, mas já foram entregues |
| `05-features/Pendencias-Epico-01.md` | 20/08/2026 | Débitos do ETL CNES e divergências de contrato | Divergências de contrato **ainda abertas** (verificado no código) |
| `08-analise tecnica/relatorio_auditoria_tecnica.md` | v3.0 · ago/2026 | 11 problemas de arquitetura frontend, estrutura proposta, roadmap de 5 sprints | Sem commit-base; escopo só frontend; 2 erros factuais (§5) |
| `08-analise tecnica/adrs.md` | v3.0 · 31/08/2026 | ADR-001..ADR-010 em formato MADR | Idem; ADR-001 não cobre download binário |
| `02-arquitetura-tecnica/Especificacao-API-v2.0.md` | v2.0 | Contrato REST publicado | 2 divergências vivas contra o código |
| `02-arquitetura-tecnica/Plano-Tecnico-Painel-Administrativo-Web-v1.0.md` | v1.0 | Stack e estrutura do painel admin (F-11) | Não iniciado |

> Este documento **não substitui** os originais. Ele consolida o que está pendente e sinaliza onde os originais precisam ser atualizados (§5).

---

## 2. Parte A — Estado consolidado do que está entregue

### 2.1 Números de referência (`develop@f26666e`)

| Camada | Medida |
|---|---|
| Backend | 6 módulos de domínio · **31 endpoints REST** · 21 classes de teste · **118 testes verdes** |
| Backend — dados | Índices declarados: 2× `2dsphere` (geofence, localização), 4× compound, únicos esparsos (CNES/CNPJ), TTL na blacklist de refresh |
| Backend — processos | 4 jobs `@Scheduled` (agregação 15min, expiração de visita, GPS interrompido, feedback sem resposta) |
| Frontend | 16 telas · 14 componentes `CS*` · 24 suítes · **166 testes verdes** |
| Infra | 5 workflows (`ci`, `cd-backend`, `cd-frontend`, `cd-mobile-eas`, `release`) · Docker multi-stage Temurin 25 · `render.yaml` |

### 2.2 Estórias do backlog × status real (atualizado pós-S8)

| Épico | Estórias | Entregues | Pendentes |
|---|---|---|---|
| Fase 0 — Segurança | F0-01..F0-05 | 5/5 | — |
| Épico 1 — Hospitais e Geofences | E1-01..E1-06 | 6/6 | — (fluxo de moderação migra para F-11) |
| Épico 2 — Detecção de Visitas | E2-01..E2-10 | 10/10 | — |
| Épico 3 — Feedback Pós-Saída | E3-01..E3-06 | 6/6 | — |
| Épico 4 — Indicadores Públicos | E4-01..E4-06 | 5/6 | **E4-06** (tendência simples) |
| Épico 5 — Conta e Privacidade | E5-01..E5-05 | 5/5 | — |
| Épico 6 — Experiência | E6-01..E6-05 | 5/5 | — |
| **Épico 7 — Painel Admin Web** | E7-01..E7-09 | **0/9** | **9 estórias P0/P1** |
| **Total** | **46 estórias** | **42 (91%)** | **4 (9%)** |

### 2.3 Features

| Feature | Status | Observação |
|---|---|---|
| F-01 Cadastro de hospitais | ✅ Funcional | Backend completo; UI administrativa depende de F-11 |
| F-02 Autenticação e conta | ✅ Funcional | JWT + BCrypt + rotação + blacklist + exclusão LGPD |
| F-03 Detecção entrada/saída | ✅ Funcional | Geofencing nativo + heartbeat |
| F-04 Visita ativa | ✅ Funcional | Card, cronômetro, check-in manual, tipo de permanência |
| F-05 Feedback pós-saída | ✅ Funcional | Backend + mobile, 4 telas, notificação + lembrete |
| F-06 Indicadores públicos | ✅ Funcional | Agregados + ranking + UI (S8) |
| F-07 Mapa e busca | ✅ Funcional | MapLibre com geofences e filtro por raio (S8) |
| F-08 Polimento e a11y | ✅ Funcional | Design System v2.0, estados, opt-in de notificações (S8) |
| F-09 Segurança e privacidade | ✅ Funcional | Consentimentos auditados, exportação PDF, rate limit |
| F-10 Moderação de sugestões | ✅ Backend + telas mobile | Absorvida por F-11 conforme decisão do backlog |
| **F-11 Painel Admin Web** | 🔴 **Não iniciado** | Plano técnico v1.0 pronto; backend 100% disponível |

### 2.4 Sprints

S0 a S6 executadas · **S8 executada** (01–02/09/2026, 5 PRs: #47, #48, #49, #50, #52) · **S7 (frente paralela do painel admin) nunca iniciada** · **não há planejamento a partir de S9**.

---

## 3. Parte B — Backlog consolidado de pendências

Sete categorias. IDs novos, criados aqui para permitir referência estável na priorização.

### B.1 — PROD · Escopo de produto não entregue

| ID | Item | Origem | Impacto se não feito | Esforço | Prior. sugerida |
|---|---|---|---|---|---|
| PROD-01 | **E7-01..E7-09 — Painel Administrativo Web (F-11)** | Backlog §Épico 7 · Sprint S7 · Plano Técnico v1.0 | Cadastro, edição de geofence, desativação e moderação só por chamada direta à API | 25 pts (~4 sem) | Alta |
| PROD-02 | E4-06 — Tendência simples de indicadores | Backlog §Épico 4 · De-Para (🔴 não planejado) | Nenhum — está fora do MVP por decisão | S | Baixa |

> O backend já expõe tudo que PROD-01 consome (`GET/POST/PUT/PATCH /api/v1/hospitais`, `/hospitais/sugestoes/**` protegidos por `hasRole("ADMIN")`). PROD-01 **não depende de nenhuma alteração no mobile** e pode correr em paralelo a qualquer outra frente.

### B.2 — CONT · Contrato e dados divergentes da especificação

| ID | Item | Evidência no código | Impacto | Esforço |
|---|---|---|---|---|
| CONT-01 | `LoginRequest` usa `password`; a spec v2.0 §3.1 define `senha` | `auth/dto/LoginRequest.java:15` | **Qualquer cliente que siga o contrato publicado quebra.** O painel admin (PROD-01) será o primeiro cliente novo | S (breaking change — exige versionar ou migrar app junto) |
| CONT-02 | Coleção MongoDB `users`; a spec v2.0 §2.2 define `usuarios` | `user/document/UserDocument.java:24` | Divergência de modelo documentado × real; exige migração de coleção | S–M |
| CONT-03 | `ImportadorEstabelecimentos` (Java) lê CSV com lat/long e não suporta shapefile — diverge do pipeline Python de fato utilizado | `hospital/migration/` | Dois caminhos de importação divergentes; risco de reimportação inconsistente | M (alinhar ou descontinuar) |
| CONT-04 | Débitos de ETL: numerais romanos em Title Case, encoding de `Regiões_de_Saúde.csv` | `Pendencias-Epico-01.md §c` | Qualidade de exibição e das camadas de região (insumo de E7-04) | S |

> **CONT-01 e CONT-02 devem ser decididos antes de PROD-01 começar** — congelar o contrato depois de existir um segundo cliente custa o dobro.

### B.3 — DOD · Definition of Done do MVP não cumprida

Critérios definidos pelo próprio projeto em `Features-MVP-v2.0.md §7` e `Backlog-MVP-v2.0.md §5`:

| ID | Critério do DoD | Situação | Evidência |
|---|---|---|---|
| DOD-01 | Cobertura ≥ 70% nas regras de negócio | ❌ **Não medida** | Sem JaCoCo no `build.gradle`; sem threshold no Jest |
| DOD-02 | Contratos documentados em OpenAPI/Swagger | ❌ **Ausente** | Sem `springdoc-openapi`; contrato mantido à mão no `.md` |
| DOD-03 | Contratos testados via testes de integração | ❌ **Ausente** | 1 único `@SpringBootTest` (smoke); todos os `*ControllerTest` usam `standaloneSetup` com serviços mockados → repositórios, agregações e consultas `2dsphere` nunca executados em teste |
| DOD-04 | Verificação de acessibilidade WCAG 2.2 AA | 🟡 **Parcial** | a11y aplicada consistentemente no código; sem auditoria formal (ferramenta + manual) |
| DOD-05 | Métricas de produto instrumentadas (funil) | ❌ **Ausente** | Nenhum evento de analytics no app |
| DOD-06 | Demo gravada por feature (3 min, device real) | ❌ Ausente | — |
| DOD-07 | Código revisado e mergeado | ✅ Atendido | Git-flow com PR em todas as entregas |
| DOD-08 | Consentimento LGPD implementado e testado | ✅ Atendido | E5-01/02/05 + exclusão + exportação PDF |

Complemento: **`VisitaControllerTest` não existe** — o fluxo de check-in/checkout não tem teste de controller.

### B.4 — VAL · Roteiro de validação pré-lançamento

Definido em `Features-MVP-v2.0.md §11`. **Nenhuma das 12 validações foi executada.** É o gate formal de lançamento que o próprio projeto escreveu.

| ID | Validação | Critério de sucesso | Bloqueia lançamento? |
|---|---|---|---|
| VAL-01 (V-01) | Teste de campo de geofence — 3 hospitais reais, 8h cada | Detecção ≥ 90%, falsos positivos ≤ 5% | **Sim** |
| VAL-02 (V-02) | Teste de bateria — 8h em background | Consumo ≤ 5% (Android + iOS) | **Sim** |
| VAL-03 (V-03) | Teste de carga da API | 100 req/s em agregados, p95 < 300ms, 0 erros 5xx | **Sim** |
| VAL-04 (V-04) | Teste de penetração básico | Senha nunca em texto puro; JWT expirado rejeitado; refresh revogado inutilizável; rate limit ativo | **Sim** |
| VAL-05 (V-05) | Compatibilidade Android 8/10/13/14 + iOS 15/16/17 + web | Jornada completa em todas | **Sim** |
| VAL-06 (V-06) | Usabilidade com ≥ 10 pacientes reais | Feedback < 45s, NPS ≥ 8 | Sim |
| VAL-07 (V-07) | Acessibilidade auditada + ≥ 1 usuário com deficiência visual | WCAG 2.2 AA | Sim (fecha DOD-04) |
| VAL-08 (V-08) | Revisão LGPD por DPO/consultor | Consentimento, política e exclusão revisados | **Sim** |
| VAL-09 (V-09) | Beta fechado 30 dias, ≥ 50 usuários | Resposta ≥ 25%, retenção D7 ≥ 30% | Sim |
| VAL-10..12 (V-10..12) | Metas de negócio (20 hospitais com N≥5; 1.000 WAU; 3 cidades) | — | Não (pós-lançamento, 90 dias) |

### B.5 — ARQ · Dívida técnica do frontend (origem: pasta 08)

Estado verificado item a item contra o código em `develop@f26666e`:

| ID | Achado (origem) | Confirmado? | Evidência | Esforço declarado | Esforço revisado |
|---|---|---|---|---|---|
| ARQ-01 | ADR-001 / Prob. 1 — cliente HTTP duplicado + race no refresh | ✅ **Sim, agravado** | **6** caminhos HTTP independentes (a S8 adicionou 2). Rotação + blacklist confirmadas em `AuthServiceImpl:66-78` → o 2º refresh concorrente sempre falha e desloga | 4–6h | **12–16h** (inclui migrar 5 suítes que mockam `fetch` + caso binário) |
| ARQ-02 | ADR-005 / Prob. 2 — JWT em `AsyncStorage` | ✅ Sim | `TokenStorage.js:1,9` com TODO no código; `expo-secure-store` ausente das dependências | 1–2h | 2–4h (limite de 2KB no iOS) |
| ARQ-03 | ADR-004 / Prob. 3 — sem estado global reativo | 🟡 Parcial | Diagnóstico correto; o sintoma "dessincronia pós-login" é atenuado pelos `useFocusEffect`. O ponto forte real é a ponte imperativa `GeofencingTaskService` ↔ `HomeScreen` | 4–6h | 6–10h |
| ARQ-04 | ADR-002 / Prob. 4 — stack JS | ✅ Sim | `App.js:2`; `native-stack ^7.14.6` e `react-native-screens` **já instalados**; `headerShown:false` em todos os navigators | 30min | **30min — melhor custo/benefício da lista** |
| ARQ-05 | ADR-003 / Prob. 5 — listas sem memoização | ✅ **Sim, propagando** | Zero `React.memo` em `src/components/`; `renderItem` inline em `HospitaisScreen:231`, `CheckinManualScreen:120`, `CSSelect:57` e **`RankingScreen:173` (criada na S8)** | 2–3h | 2–3h para `useCallback`+`memo`; **FlashList adiado** (ganho não comprovado com listas paginadas de ~20 itens) |
| ARQ-06 | Prob. 6 — barrel exports inflando bundle | ❌ **Rebaixado** | A justificativa central é falsa (§5.1). Restam 7 arquivos importando o barrel, sem medição de impacto | — | Medir antes de agir |
| ARQ-07 | ADR-006 / Prob. 7 — `TouchableOpacity` × `Pressable` | ✅ Sim | 28 instâncias em 6 arquivos (`PerfilScreen` 9, `UserScreen` 7, `LoginScreen` 7, `SugestoesPendentes` 2, `GeoLocalizacao` 2, `Privacidade` 1) | 3–4h | 3–4h |
| ARQ-08 | ADR-007 / Prob. 8 — enums e RN-15 no componente visual | ✅ Sim | `CSHospitalCard.js:9,15,42` e `HospitalDetalheScreen.js:33,39` | 1h | 1–2h |
| ARQ-09 | Prob. 9 — `carregar` não estabilizada | ✅ Sim | `HospitalDetalheScreen.js:60` | — | 30min |
| ARQ-10 | ADR-009 / Prob. 10 — heartbeat sem `AppState` | ✅ Sim | `HeartbeatService.js:54`; limitação admitida no comentário da linha 9 | 1–2h | 1–2h |
| ARQ-11 | ADR-010 / Prob. 11 — TypeScript inerte | ✅ Sim | `tsconfig.json` com `strict:true` + `checkJs:false` e **zero arquivos `.ts`/`.tsx`** → `npm run typecheck` não verifica nada | incremental | incremental |
| ARQ-12 | ADR-008 — estrutura feature-first | 🟡 Válido, mas caro e menos urgente | Ver ressalvas em §5.4 | incremental | incremental |
| ARQ-13 | Barrel legado `screens/views/index.js` | ✅ Sim, **risco zero** | Nenhum importador em todo o repositório | — | 5min |

### B.6 — ENG · Lacunas de engenharia (não cobertas por nenhum documento existente)

| ID | Lacuna | Evidência | Impacto |
|---|---|---|---|
| ENG-01 | **O CI não roda os testes do frontend** | `ci.yml` executa `npm run typecheck` (que não verifica nada — ARQ-11) e `expo export`. Os **166 testes nunca rodam em PR** | **Crítico.** O único gate real do app hoje é execução manual. Toda a refatoração de B.5 seria feita sem rede |
| ENG-02 | Sem linter em nenhum lado | Sem ESLint/Prettier no frontend; sem Spotless/Checkstyle no backend | As inconsistências catalogadas em ARQ-05/07 são exatamente o que um lint bloquearia na origem |
| ENG-03 | Sem crash reporting | Nenhum Sentry/Crashlytics no app nem no backend | O crash do PR #46 foi descoberto por relato verbal, sem stack trace |
| ENG-04 | Sem varredura de dependências / SAST | Sem Dependabot, sem CodeQL | App que trata dado pessoal sensível sem alerta de CVE |
| ENG-05 | 7 telas sem teste unitário | `LoginScreen`, `CheckinManualScreen`, `SugerirHospitalScreen`, `RevisarSugestaoScreen`, `SugestoesPendentesScreen`, `PrivacidadeScreen`, `HomeScreen` | Duas delas em fluxo crítico |
| ENG-06 | Sem testes E2E | Sem Detox/Maestro | Nenhuma cobertura da jornada completa em device |

### B.7 — OPS · Prontidão para produção

| ID | Lacuna | Evidência | Impacto |
|---|---|---|---|
| OPS-01 | **Backend no plano `free` do Render** | `render.yaml`: `plan: free` | A instância hiberna por inatividade. O `POST /visitas/checkin` disparado pelo geofencing **em background, sem usuário olhando a tela**, é o pior caso possível para cold start → **visitas perdidas silenciosamente** |
| OPS-02 | Estado de instância única não declarado | `RateLimitService` usa `ConcurrentHashMap` em memória; 4 jobs `@Scheduled` sem lock distribuído | Com 2 réplicas: jobs duplicados e rate limit efetivo dobrado. Precisa de ShedLock/Redis **ou** de restrição documentada |
| OPS-03 | Superfície de abuso dos indicadores públicos | `POST /visitas/checkin`, `/checkout`, `/heartbeat` e `POST /feedbacks` são `permitAll()` (decisão correta de produto — conta opcional, E5-04); rate limit é **por IP** | Dados públicos podem ser injetados sem identidade. Mitigado parcialmente por RN-15 (N≥5). Falta vincular ao `dispositivoId` que o app já gera |
| OPS-04 | Sem observabilidade de métricas | `actuator` presente, sem Micrometer/Prometheus; sem correlation-id nos logs | Sem visibilidade de p95, taxa de erro ou saúde dos jobs — VAL-03 não tem como ser medido |
| OPS-05 | Sem tratamento de rede degradada no app | Sem timeout, retry com backoff ou fila offline | Produto cujo caso de uso é dentro do hospital, onde o sinal é ruim |
| OPS-06 | Sem política de retenção LGPD (art. 16) | Há exclusão sob demanda e anonimização; não há expurgo automático de visitas/feedbacks antigos | Conformidade incompleta |
| OPS-07 | Backup/restore não testado | — | DR presumido, não verificado |

---

## 4. Parte C — Consolidação numérica

| Categoria | Itens | Origem |
|---|---|---|
| PROD — produto | 2 (sendo 1 com 9 estórias) | Backlog / Sprints |
| CONT — contrato e dados | 4 | Pendências Épico 01 / Spec API |
| DOD — Definition of Done | 6 abertos de 8 | Features §7 / Backlog §5 |
| VAL — validação pré-lançamento | 12 (0 executadas) | Features §11 |
| ARQ — dívida frontend | 11 confirmados, 1 rebaixado, 1 trivial | Pasta 08 |
| ENG — engenharia | 6 | **Novo — nenhum documento cobria** |
| OPS — operação | 7 | **Novo — nenhum documento cobria** |
| **Total** | **48 itens rastreáveis** | |

**Leitura:** 91% do escopo funcional do MVP está entregue. O que separa o sistema do lançamento **não é feature** — é contrato congelado, processo de engenharia, validação formal e prontidão operacional.

---

## 5. Parte D — Divergências entre os documentos (a corrigir nos originais)

### 5.1 Erros factuais na auditoria técnica (pasta 08)

1. **Problema 6:** afirma que `CSGeoStatusCard` arrasta `@maplibre/maplibre-react-native` para o bundle. **Falso** — o arquivo importa apenas `react`, `react-native`, `CSCard`, `CSButton` e `../theme`. O maplibre é importado diretamente só por `GeoLocalizacaoScreen` e `HospitalDetalheScreen`. Sem esse elo, o P6 perde sua justificativa técnica.
2. **Diagrama da estrutura atual:** anota `CSGeoStatusCard.js ← Dependência de GeofencingTaskService`. **Falso** — não há tal import.
3. **Problema estrutural 4:** descreve `src/services/` como "diretório singleton com um arquivo". Hoje tem três (`TokenStorage`, `DispositivoId`, `NotificacaoPermissao`).
4. **ADR-001:** o `apiClient` proposto assume JSON em tudo (`JSON.stringify` no body, `JSON.parse` na resposta) e **não acomoda o download binário do PDF** (`File.downloadFileAsync`, que nem passa por `fetch`). Implementado como escrito, `PerfilService` fica fora do mutex e a race condition sobrevive justamente no fluxo LGPD. **Correção necessária:** expor `apiRequest` **e** `apiDownload` compartilhando o mesmo `refreshPromise`.
5. **Sem commit-base declarado** — os documentos envelhecem em silêncio.

### 5.2 Documentos com status defasado

| Documento | Divergência |
|---|---|
| `De-Para-Backlog-Features.md` | E4-05, E5-05, E6-05, E3-02 e E3-03 constam como parciais/pendentes — todos entregues até 02/09 |
| `Features-MVP-v2.0.md` | Status de código de 08/08: descreve F-01, F-03 e F-06 como "🔴 Inexistente"; as três estão funcionais |
| `Plano-Sprints-v2.0.md §21.4` | Prevê exportação em **CSV**; foi entregue em **PDF** (decisão de acessibilidade à população, LGPD art. 18) |
| `Plano-Sprints-v2.0.md §21.2/21.6` | Cita `react-native-maps`; a implementação usa `@maplibre/maplibre-react-native` |
| `Backlog-MVP-v2.0.md` E5-05 | Descreve apenas revogação de **geolocalização**; o entregue é mais amplo (consentimento por finalidade, incluindo notificações, auditado em `PUT /contas/consentimentos`) |

### 5.3 Divergências código × contrato publicado

`LoginRequest.password` × spec `senha` (CONT-01) e coleção `users` × spec `usuarios` (CONT-02) — ambas **abertas**, apontadas desde 20/08.

### 5.4 Ressalvas ao roadmap proposto na pasta 08

| Proposta original | Ressalva |
|---|---|
| Sprint 1 começa pelo `apiClient` | Refatorar a camada de sessão com o CI sem rodar testes de frontend (ENG-01) é o cenário de risco máximo |
| ADR-004 (Context) só na Sprint 3 | Mesmo fluxo de ARQ-01/ARQ-02 — separar em 3 sprints espalha risco de regressão de autenticação por 5 semanas |
| ADR-003: adotar FlashList | Medir primeiro; `useCallback` + `React.memo` entregam o ganho declarado sem dependência nativa |
| ADR-008: renomear o Design System para `.jsx` | Conflita com ADR-010 (`.tsx`) — seriam dois renames do mesmo arquivo |
| ADR-008: "nunca commits só de movimentação" | A própria Fase 0/2 do ADR exige exatamente isso |
| Escopo restrito ao frontend | Backend, CI e operação concentram os riscos de lançamento (ENG-*, OPS-*) |

---

## 6. Parte E — Eixos para a priorização (próxima etapa)

A priorização depende de qual meta vem primeiro. Os itens acima se reorganizam de forma diferente conforme o objetivo:

| Se o objetivo for… | O bloco que domina a ordem |
|---|---|
| **Beta fechado com usuários reais** | OPS-01 (cold start), ENG-03 (crash reporting), VAL-01/02 (campo e bateria), ENG-01 |
| **Lançamento público** | Todo o bloco VAL (12 validações) + OPS-01..04 + DOD-01..03 |
| **Completar o produto documentado** | PROD-01 (painel admin) — antes, CONT-01/02 para congelar o contrato |
| **Sustentar o código a longo prazo** | ENG-01/02 primeiro, depois ARQ-01..05, depois ARQ-11/12 |
| **Conformidade LGPD plena** | VAL-08, OPS-06, ARQ-02 |

**Critérios sugeridos para ordenar** (a validar): (1) bloqueia lançamento? · (2) é pré-requisito de outro item? · (3) custo de fazer depois × custo de fazer agora · (4) risco de regressão introduzido.

**Dependências duras já identificadas:**
- `CONT-01/02` **antes** de `PROD-01` (congelar contrato antes do 2º cliente)
- `ENG-01` **antes** de `ARQ-01..05` (rede de testes antes de refatorar)
- `OPS-04` **antes** de `VAL-03` (sem métricas não há como medir p95)
- `ARQ-11` (`checkJs`/tipos) **antes** de `ARQ-12` (feature-first), conforme o próprio ADR-010

---

*Consolidação encerrada em `develop@f26666e`. Priorização a definir em conjunto.*
