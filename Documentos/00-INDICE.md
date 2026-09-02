# 📚 Índice Central da Documentação — saude-monitor

> **Sistema de Monitoramento Hospitalar por Geolocalização (Clinical Sanctuary)**
> Última atualização: 02/09/2026 · Responsável: Gabriel Vogado

---

## 📌 Última revisão (02/09/2026) — Realinhamento documental pós-Sprint S8

**Motivo:** os documentos não foram atualizados durante o desenvolvimento e passaram a descrever um sistema que não existe mais. Em 02/09/2026, o `Features-MVP` ainda marcava cinco features entregues como "🔴 Inexistente" e registrava como aberta uma violação de segurança corrigida na Fase 0; o `De-Para` estava congelado antes da Sprint S8; e o `Plano-Sprints` terminava em "S6 — Polimento e Lançamento", sem nada depois.

**Três decisões do Product Owner** motivaram esta revisão e estão registradas literalmente no `Backlog-MVP-v2.1.md` §2.1:

1. **Painel Administrativo Web adiado** — o Épico 7 (F-11) sai do caminho crítico e cai de P0 para P2; só entra depois que o app estiver sem pendências nem débitos técnicos.
2. **Testes de campo não são executáveis** — o sistema está lento em todas as telas. Medição direta em 02/09/2026: **109 s e HTTP 503 na primeira abertura** após ociosidade; **1 a 5 s por requisição** com o serviço quente. Causa: a instância do backend (`plan: free` no Render), não o código do aplicativo. As validações V-01, V-02, V-06 e V-09 ficam **bloqueadas**.
3. **Documentos desatualizados** — origem desta revisão.

**Consequências estruturais:**

- Novo **Épico 8 — Estabilização, Desempenho e Qualidade** (15 estórias, `Backlog-MVP-v2.1.md`), cobrindo o que nenhum documento cobria.
- Novas sprints **S9 a S12** (`Plano-Sprints-v2.1.md` §22): desempenho → qualidade e observabilidade → validação pré-lançamento → beta fechado. O Painel Admin passa a ser S13.
- **DoD do MVP: 2 de 7 critérios atendidos.** Cobertura de testes nunca medida, sem OpenAPI, sem testes de integração, sem auditoria WCAG, sem analytics.
- Documentos versionados nesta revisão: `Features-MVP` v2.1 · `Backlog-MVP` v2.1 · `Plano-Sprints` v2.1 · `Relatorio-Aderencia` v3.6 · `De-Para` (02/09) · `relatorio_auditoria_tecnica` v3.1 · `adrs` v3.1 · `Consolidacao-Tecnica` v1.1.

> **Regra criada para não repetir o problema** (`Backlog-MVP-v2.1.md` §8): **o PR que entrega uma estória atualiza o status dela no `De-Para`, no mesmo PR.** Sem isso, o PR não fecha a estória.

---

## 📌 Revisão anterior (01/09/2026)

**Correcao de check-in manual e carregamento inicial da lista:**

- Garante uma unica visita ativa por usuario ou dispositivo, seja manual ou geofence; segunda visita em hospital diferente retorna conflito.
- Remove a concorrencia entre toque de check-in e navegacao ao detalhe que podia encerrar o app Android.
- Carrega a lista de hospitais imediatamente na primeira abertura; o debounce permanece apenas na busca e nos filtros.
- Registro, impacto e evidencias: [Registro de Correcao - Check-in Manual e Performance v1.0](./05-features/Registro-Correcao-Checkin-Manual-e-Performance-v1.0.md).

---

**Correção de regra de negócio — RN-04/RN-16/RN-17** (validação com stakeholders):

- **Antes:** visita expirava após **8h** sem saída confirmada; tempo médio considerava visitas ≤ 8h.
- **Problema:** cortava a medição exatamente no cenário comum da saúde pública brasileira — filas de **12h+** em pronto-socorros.
- **Agora:** a visita **não expira por tempo de permanência** — expira apenas após **24h sem heartbeat** (RN-04/RN-23). Novas regras: **RN-23** (heartbeat a cada 30min) e **RN-24** (sinalização de internação/observação em 1 toque aos 12h). Tempo médio considera visitas ≤ 24h, excluindo internação/observação (RN-16/RN-17).
- **Documentos afetados:** Negocial (§6, §8, §13, §14) · Especificação da API (coleções `visitas`/`agregados_hospitais`, endpoints heartbeat/tipo-permanencia/expirar) · Backlog (E2-03, E2-09, E2-10, E4-02) · UI/UX (§12 pergunta resolvida).

---

## Como navegar neste índice

Este repositório de documentação segue uma estrutura versionada:

- **`_historico/`** — documentos das fases anteriores, preservados como memória institucional (não editar).
- **Documentos ativos** — a documentação vigente do produto, organizada por domínio. Após a revisão de 02/09/2026, as versões correntes são: Negocial v2.0 · Arquitetura v2.0 · UI/UX v2.0 · **Backlog v2.1** · **Features v2.1** · **Plano de Sprints v2.1** · **Aderência v3.6** · **Consolidação Técnica v1.1**.

Regra de versionamento: toda alteração relevante de um documento ativo deve gerar uma **nova versão** (ex.: `v2.0` → `v2.1`) e o conteúdo antigo é movido para `_historico/`. Nunca sobrescreva o histórico.

---

## 📁 Estrutura de pastas

```
Documentos/
├── 00-INDICE.md                              ← você está aqui
│
├── 01-negocio/                               ← visão de negócio do produto
│   └── Documento-Negocial-v2.0.md            ← problema, público, jornada, regras de negócio, LGPD, KPIs
│
├── 02-arquitetura-tecnica/                   ← visão técnica e de engenharia
│   ├── Arvore-Tecnologica-v2.0.md            ← stack atual vs. proposta, manter/refatorar, ADRs, roadmap
│   ├── Especificacao-API-v2.0.md             ← contratos REST (OpenAPI), modelo de dados MongoDB, fluxos
│   └── Plano-Tecnico-Painel-Administrativo-Web-v1.0.md  ← stack, estrutura de pastas e consumo de API do painel web (F-11)
│
├── 03-ui-ux/                                 ← padrão de experiência e interface
│   └── Padrao-UI-UX-v2.0.md                  ← princípios, personas, jornada, design system, acessibilidade, LGPD
│
├── 04-backlog/                               ← planejamento de produto e entregas
│   └── Backlog-MVP-v2.1.md                   ← épicos/estórias priorizadas (MoSCoW), critérios de aceite, Épico 8, sprints
│
├── 05-features/                              ← features detalhadas + aderência ao código real
│   ├── Features-MVP-v2.1.md                  ← 11 features com status real, estado operacional (§2.1), DoDs, rastreabilidade
│   ├── Relatorio-Aderencia-Codigo-vs-Features.md ← verificação arquivo a arquivo + aderência operacional (§1.1)
│   ├── Pendencias-Epico-01.md                ← débitos do ETL CNES/DATASUS e divergências de contrato
│   └── Registro-Correcao-Checkin-Manual-e-Performance-v1.0.md ← RN-03A (exclusividade de visita ativa)
│
├── 06-sprints/                               ← planejamento de entregas ágeis
│   └── Plano-Sprints-v2.1.md                 ← S0–S8 executadas, S7 adiada, S9–S12 planejadas (§22)
│
├── 07-dados/                                 ← relatórios de importação e enriquecimento de dados
│   └── (5 relatórios de ETL CNES/DATASUS e auditoria de campos)
│
├── 08-analise tecnica/                       ← auditoria técnica e consolidação de pendências
│   ├── Consolidacao-Tecnica-e-Backlog-Pendente-v1.1.md ← fonte única do que está entregue, pendente e priorizado
│   ├── relatorio_auditoria_tecnica.md        ← 11 problemas de arquitetura frontend (v3.1)
│   └── adrs.md                               ← ADR-001..010, todos em status Proposto (v3.1)
│
├── De-Para-Backlog-Features.md               ← status estória × feature (fonte de verdade de status)
│
└── _historico/                               ← documentos das fases anteriores (preservados, não editar)
    ├── v1.0-sas/                             ← fase 1: Sistema de Agendamento de Saúde (SAS)
    ├── v1.1-monitoramento/                   ← fase 2: arquitetura do monitoramento hospitalar + custos
    ├── v1.2-design-clinical-sanctuary/       ← fase 3: design system "Clinical Sanctuary" (painel institucional)
    ├── v2.0-design-ui-ux/                    ← rascunho da v1 do documento UI/UX (substituído pela versão em 03-ui-ux)
    ├── 08-analise-tecnica-v3.0/              ← auditoria v3.0, ADRs v3.0 e Consolidação v1.0 (substituídos em 02/09/2026)
    ├── Features-MVP-v2.0.md                  ← substituído pela v2.1 em 02/09/2026
    ├── Backlog-MVP-v2.0.md                   ← substituído pela v2.1 em 02/09/2026
    ├── Plano-Sprints-v2.0.md                 ← substituído pela v2.1 em 02/09/2026
    ├── Relatorio-Aderencia-Codigo-vs-Features-v1.md / -v3.5.md
    └── De-Para-Backlog-Features-v1.md / -v2.md ← retratos anteriores do status das estórias
```

---

## 📄 Documentos ativos

| # | Documento | Versão | Status | Resumo |
|---|---|---|---|---|
| 1 | [Documento Negocial](./01-negocio/Documento-Negocial-v2.0.md) | 2.0 | ✅ Ativo | Problema, proposta de valor, público, jornada do usuário, regras de negócio do geofence/feedback, modelo de dados conceitual, KPIs, roadmap e conformidade LGPD. |
| 2 | [Árvore Tecnológica](./02-arquitetura-tecnica/Arvore-Tecnologica-v2.0.md) | 2.0 | ✅ Ativo | Mapa da stack atual (Spring Boot 4 + MongoDB + Expo 55), decisões manter/refatorar/adicionar, matriz comparativa, ADRs e plano de evolução. |
| 3 | [Especificação da API](./02-arquitetura-tecnica/Especificacao-API-v2.0.md) | 2.0 | ✅ Ativo | Contratos REST de todos os endpoints (auth, hospitais, visitas, feedbacks, agregados), coleções MongoDB com índices/GeoJSON e fluxo geofence → API. |
| 3b | [Plano Técnico — Painel Administrativo Web](./02-arquitetura-tecnica/Plano-Tecnico-Painel-Administrativo-Web-v1.0.md) | 1.0 | 🟡 Proposta | Stack (React + Vite + Leaflet), estrutura de pastas de `web-admin/` e estratégia de consumo da API existente para o painel administrativo (F-11). |
| 4 | [Padrão UI/UX](./03-ui-ux/Padrao-UI-UX-v2.0.md) | 2.0 | ✅ Ativo | Princípios de UX, personas, jornada ponta a ponta, arquitetura de informação, design system completo (tokens, componentes), acessibilidade WCAG AA, LGPD por design e protótipos ASCII. |
| 5 | [Backlog do MVP](./04-backlog/Backlog-MVP-v2.1.md) | **2.1** | ✅ Ativo | Backlog priorizado (Fase 0 + 8 épicos), decisões de priorização (§2.1), **Épico 8 — Estabilização e Desempenho**, sequência real S0–S8 + planejada S9–S12, DoD com situação real e regra de atualização documental. |
| 6 | [Plano de Sprints](./06-sprints/Plano-Sprints-v2.1.md) | **2.1** | ✅ Ativo | S0–S6 e S8 concluídas, S7 adiada, **S9–S12 planejadas (§22)** com diagnóstico de desempenho medido, velocity, riscos, cerimônias e métricas. |
| 7 | [Registro de Correção - Check-in Manual e Performance](./05-features/Registro-Correcao-Checkin-Manual-e-Performance-v1.0.md) | 1.0 | ✅ Implementado | Exclusividade de visita ativa (RN-03A), correção da interação do card e da latência artificial na primeira carga da lista. A validação pendente nº 5 (*"medir login e primeira lista no ambiente de destino"*) foi executada em 02/09/2026 — resultado no `Features-MVP-v2.1.md` §2.1. |
| 8 | [Features do MVP](./05-features/Features-MVP-v2.1.md) | **2.1** | ✅ Ativo | As 11 features com status real por feature, **§2.1 — estado operacional** (implementado ≠ utilizável), DoD por feature, matriz de rastreabilidade e roteiro de validação V-01..V-12 com situação de cada uma. |
| 9 | [Relatório de Aderência Código × Features](./05-features/Relatorio-Aderencia-Codigo-vs-Features.md) | **3.6** | ✅ Ativo | Verificação arquivo a arquivo das 9 features do escopo (100% cobertas) + **§1.1 aderência operacional**, que reprova o RNF-02 por medição. |
| 10 | [De-Para Backlog × Features](./De-Para-Backlog-Features.md) | 02/09/2026 | ✅ Ativo | **Fonte de verdade do status de cada estória.** Placar: 42 de 43 estórias do app entregues; Épico 7 adiado; Épico 8 aberto. |
| 11 | [Consolidação Técnica e Backlog Pendente](./08-analise%20tecnica/Consolidacao-Tecnica-e-Backlog-Pendente-v1.1.md) | **1.1** | ✅ Ativo | Fonte única do que está entregue, do que está pendente (48 itens + PERF) e da **ordem de execução em 6 ondas**, com as decisões do PO registradas literalmente. |
| 12 | [Relatório de Auditoria Técnica](./08-analise%20tecnica/relatorio_auditoria_tecnica.md) | **3.1** | 🟡 Proposta | 11 problemas de arquitetura do frontend. A v3.1 declara o commit-base e **corrige 3 afirmações** que não se sustentaram na reverificação. |
| 13 | [ADRs](./08-analise%20tecnica/adrs.md) | **3.1** | 🟡 Proposta | ADR-001..ADR-010 em formato MADR, **todos em status `Proposto`**. Precedência revista: entram depois da Sprint S10. |
| 14 | [Pendências do Épico 01](./05-features/Pendencias-Epico-01.md) | — | 🟡 Aberto | Débitos do ETL CNES/DATASUS e as 2 divergências de contrato abertas desde 20/08/2026 (tratadas em E8-14). |

---

## 🗃️ Histórico de versões da documentação

| Fase | Versão | O que era | Status |
|---|---|---|---|
| 1 — SAS | v1.0 | Sistema de Agendamento de Saúde: agendamento de consultas, triagem, exames, feedback pós-consulta. Visão original, **descontinuada como produto** (mantida como insumo de requisitos de feedback). | Arquivo morto |
| 2 — Monitoramento | v1.1 | Arquitetura de solução para monitoramento hospitalar por geolocalização (microsserviços, PostGIS, Kafka) + estimativas de custo do MVP. | Arquivo morto (insumo) |
| 3 — Design | v1.2 | Design system "Clinical Sanctuary" para painel institucional (gestor hospitalar). | Arquivo morto (insumo de identidade visual) |
| 4 — Documentação atual | v2.0 | Produto focado no **paciente/cidadão**: detecção automática via geofence, tempo de permanência, feedback curto pós-saída e transparência pública de avaliação dos hospitais. | **Vigente** |

---

## 🧭 Guia de leitura por papel

| Quem é você | Comece por |
|---|---|
| **Product Owner / Negócio** | `01-negocio/Documento-Negocial-v2.0.md` → `04-backlog/Backlog-MVP-v2.1.md` → `De-Para-Backlog-Features.md` (status real) |
| **Arquiteto / Backend** | `02-arquitetura-tecnica/Arvore-Tecnologica-v2.0.md` (decisões, ADRs) → `02-arquitetura-tecnica/Especificacao-API-v2.0.md` (contratos) |
| **Frontend / Mobile** | `03-ui-ux/Padrao-UI-UX-v2.0.md` → `02-arquitetura-tecnica/Especificacao-API-v2.0.md` (consumo) |
| **Designer** | `03-ui-ux/Padrao-UI-UX-v2.0.md` → `_historico/v1.2-design-clinical-sanctuary/` (base da identidade) |
| **QA / Testes** | Regras de negócio (Documento Negocial §6) + critérios de aceite (Backlog) + contratos (Especificação da API) |
| **Scrum Master / Agile Coach** | `06-sprints/Plano-Sprints-v2.1.md` (§22 = próximas sprints) → `04-backlog/Backlog-MVP-v2.1.md` |
| **Quem vai retomar o desenvolvimento** | `08-analise tecnica/Consolidacao-Tecnica-e-Backlog-Pendente-v1.1.md` §0 — é a fonte da priorização vigente e diz, em uma página, o que fazer primeiro e por quê |
| **Novo integrante** | `00-INDICE.md` → leia na ordem: 1 (negócio) → 4 (UI/UX) → 2 (arquitetura) → 3 (API) → 5 (backlog) |

---

## ⚠️ Avisos de manutenção

1. **Não edite** arquivos dentro de `_historico/` — eles são a memória institucional.
2. Ao criar uma nova versão de um documento ativo, mova a versão antiga para `_historico/` com o mesmo nome e sufixo de versão.
3. Atualize este índice sempre que adicionar, mover ou versionar documentos.
4. Documentos em PDF/DOCX do histórico (v1.x) estão preservados; novos documentos devem ser criados em **Markdown** para manter rastreabilidade no git.
5. **O PR que entrega uma estória atualiza o status dela em `De-Para-Backlog-Features.md`, no mesmo PR** (regra criada em 02/09/2026 — `Backlog-MVP-v2.1.md` §8). A defasagem documental de agosto custou uma auditoria inteira baseada em status falsos.
6. Auditorias e relatórios técnicos devem **declarar o commit-base** no cabeçalho. Sem isso, não são reverificáveis — foi o que aconteceu com a v3.0 da auditoria técnica.
7. A pasta `08-analise tecnica/` **não estava versionada no git** até 02/09/2026 — auditoria técnica, ADRs e Consolidação existiam apenas no disco local, sem histórico. Foram incorporadas ao repositório na revisão desta data (branch `doc/atualizacao-documental-pos-s8`), junto das cópias v3.0/v1.0 em `_historico/08-analise-tecnica-v3.0/`. **Documento que não está no git não existe para o time.**
