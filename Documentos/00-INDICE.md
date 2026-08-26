# 📚 Índice Central da Documentação — saude-monitor

> **Sistema de Monitoramento Hospitalar por Geolocalização (Clinical Sanctuary)**
> Última atualização: 07/08/2026 · Responsável: Gabriel Vogado

---

## 📌 Última revisão (07/08/2026)

**Correção de regra de negócio — RN-04/RN-16/RN-17** (validação com stakeholders):

- **Antes:** visita expirava após **8h** sem saída confirmada; tempo médio considerava visitas ≤ 8h.
- **Problema:** cortava a medição exatamente no cenário comum da saúde pública brasileira — filas de **12h+** em pronto-socorros.
- **Agora:** a visita **não expira por tempo de permanência** — expira apenas após **24h sem heartbeat** (RN-04/RN-23). Novas regras: **RN-23** (heartbeat a cada 30min) e **RN-24** (sinalização de internação/observação em 1 toque aos 12h). Tempo médio considera visitas ≤ 24h, excluindo internação/observação (RN-16/RN-17).
- **Documentos afetados:** Negocial (§6, §8, §13, §14) · Especificação da API (coleções `visitas`/`agregados_hospitais`, endpoints heartbeat/tipo-permanencia/expirar) · Backlog (E2-03, E2-09, E2-10, E4-02) · UI/UX (§12 pergunta resolvida).

---

## Como navegar neste índice

Este repositório de documentação segue uma estrutura versionada:

- **`_historico/`** — documentos das fases anteriores, preservados como memória institucional (não editar).
- **Documentos ativos (v2.0)** — a documentação vigente do produto, organizada por domínio.

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
│   └── Backlog-MVP-v2.0.md                   ← épicos/estórias priorizadas (MoSCoW), critérios de aceite, sprints
│
├── 05-features/                              ← features detalhadas + aderência ao código real
│   ├── Features-MVP-v2.0.md                  ← 9 features com status de implementação, DoDs, matriz de rastreabilidade
│   └── Relatorio-Aderencia-Codigo-vs-Features.md ← verificação arquivo a arquivo (19 BE + 12 FE) do que existe × falta
│
├── 06-sprints/                               ← planejamento de entregas ágeis
│   └── Plano-Sprints-v2.0.md                 ← plano de 7 sprints, velocity, riscos, métricas, cerimônias
│
└── _historico/                               ← documentos das fases anteriores (preservados)
    ├── v1.0-sas/                             ← fase 1: Sistema de Agendamento de Saúde (SAS)
    ├── v1.1-monitoramento/                   ← fase 2: arquitetura do monitoramento hospitalar + custos
    ├── v1.2-design-clinical-sanctuary/       ← fase 3: design system "Clinical Sanctuary" (painel institucional)
    └── v2.0-design-ui-ux/                    ← rascunho da v1 do documento UI/UX (substituído pela versão em 03-ui-ux)
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
| 5 | [Backlog do MVP](./04-backlog/Backlog-MVP-v2.0.md) | 2.0 | ✅ Ativo | Backlog priorizado (Fase 0 + 6 épicos), estórias com critérios de aceite e referências às RN, sequência de sprints, DoD e backlog futuro. |
| 6 | [Plano de Sprints](./06-sprints/Plano-Sprints-v2.0.md) | 2.0 | ✅ Ativo | Plano detalhado de 7 sprints (S0–S6), estimativas em story points (Fibonacci), velocity, riscos por sprint, cerimônias, métricas de acompanhamento e plano de testes de campo. |

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
| **Product Owner / Negócio** | `01-negocio/Documento-Negocial-v2.0.md` → `04-backlog/Backlog-MVP-v2.0.md` |
| **Arquiteto / Backend** | `02-arquitetura-tecnica/Arvore-Tecnologica-v2.0.md` (decisões, ADRs) → `02-arquitetura-tecnica/Especificacao-API-v2.0.md` (contratos) |
| **Frontend / Mobile** | `03-ui-ux/Padrao-UI-UX-v2.0.md` → `02-arquitetura-tecnica/Especificacao-API-v2.0.md` (consumo) |
| **Designer** | `03-ui-ux/Padrao-UI-UX-v2.0.md` → `_historico/v1.2-design-clinical-sanctuary/` (base da identidade) |
| **QA / Testes** | Regras de negócio (Documento Negocial §6) + critérios de aceite (Backlog) + contratos (Especificação da API) |
| **Scrum Master / Agile Coach** | `06-sprints/Plano-Sprints-v2.0.md` → `04-backlog/Backlog-MVP-v2.0.md` |
| **Novo integrante** | `00-INDICE.md` → leia na ordem: 1 (negócio) → 4 (UI/UX) → 2 (arquitetura) → 3 (API) → 5 (backlog) |

---

## ⚠️ Avisos de manutenção

1. **Não edite** arquivos dentro de `_historico/` — eles são a memória institucional.
2. Ao criar uma nova versão de um documento ativo, mova a versão antiga para `_historico/` com o mesmo nome e sufixo de versão.
3. Atualize este índice sempre que adicionar, mover ou versionar documentos.
4. Documentos em PDF/DOCX do histórico (v1.x) estão preservados; novos documentos devem ser criados em **Markdown** para manter rastreabilidade no git.
