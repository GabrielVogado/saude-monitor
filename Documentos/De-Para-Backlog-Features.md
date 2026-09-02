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
| Épico 8 — Estabilização e Desempenho (novo, v2.1) | 1 | 15 | 7% |

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
| **E8-01** | Eliminar cold start na primeira abertura | Cross | 🔴 Pendente — **P0**, medido em 109 s com HTTP 503 |
| **E8-02** | Cumprir o orçamento de latência do RNF-02 | Cross | 🔴 Pendente — **P0**, medido em 1,9–4,9 s (orçamento: 300 ms p95) |
| **E8-03** | Enxugar o payload da listagem de hospitais | **F-01**, **F-07** | ✅ Entregue (02/09/2026) — o `geofence` era 73,6% do corpo (27.849 de 37.838 B). Substituído por `localizacao` + `raioMetros`; cliente reconstrói o círculo. Estimado 35,7 KB → ~11 KB (−70%), **medição pós-deploy pendente** |
| **E8-04** | Estados de carregamento/erro com timeout explícito | **F-08** | 🔴 Pendente — **P0** |
| **E8-05** | Inventário dos bugs observados em uso | Cross | 🔴 Pendente — **P0**, depende de insumo do Product Owner |
| **E8-06** | Métricas de latência e erro por endpoint | Cross | 🔴 Pendente |
| **E8-07** | Crash reporting no app | Cross | 🔴 Pendente |
| **E8-08** | Medição de cobertura de testes (DoD ≥ 70%) | Cross | 🔴 Pendente — 118 testes no BE e 166 no FE, cobertura nunca medida |
| **E8-09** | Contrato OpenAPI publicado | **F-09** | 🔴 Pendente |
| **E8-10** | Testes de integração com contexto Spring | Cross | 🔴 Pendente |
| **E8-11** | Analytics de produto (funil, retenção) | Cross | 🔴 Pendente |
| **E8-12** | CI rodando `npm test` no frontend | Cross | 🔴 Pendente — **P0**, hoje a esteira roda apenas `typecheck` e `expo export` |
| **E8-13** | Lint no frontend (o `typecheck` atual não verifica nada) | Cross | 🔴 Pendente |
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
