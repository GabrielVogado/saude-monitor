# 🗺️ Mapeamento De-Para: Backlog vs Features (MVP v2.0)

Este documento estabelece o mapeamento direto entre as **Estórias de Usuário (Backlog)** e as **Features** da arquitetura do MVP.

> **Escopo da auditoria (30/08/2026):** atenção exclusiva ao MVP **Sprints S0–S6**. Itens planejados para a **Sprint S8** (pendências/stretch) e para o **Épico 7 / Painel Administrativo Web (F-11)** são **fora do escopo do MVP** e **não contam como pendência** aqui.

## Fase 0 — Estabilização e Segurança
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **F0-01** | Hash BCrypt para senhas | **F-02**, **F-09** | ✅ Existente (Seguro) |
| **F0-02** | Autenticação via JWT | **F-02** | ✅ Existente |
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
| **E3-02** | Form < 45s (4 perguntas) | **F-05** | 🟡 Parcial (RN-10/11): fluxo de 4 telas + "Pular" ok (`FeedbackFormScreen`), mas: especialidade é **texto livre** (doc pede select searchable CNES/DATASUS); ramificação "triagem=Não → pula especialidade" não implementada; `tratamentoEquipe` usa **estrelas 1–5 sem a opção "Não interagi"** (doc pede escala 5pts + Não interagi); há opção extra `DESISTI` em `foiAtendido` |
| **E3-03** | Responder em 24h + lembrete | **F-05** | 🟡 Parcial no escopo S0–S6 (Janela de 24h + único lembrete ✅, job `SEM_FEEDBACK` ✅): o lembrete é agendado em **+1h** e a doc especifica **~6h** após a 1ª notificação — alinhar |
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
| **E4-05** | Ranking hospitais | **F-06** | 🟢 Backend (PR #27: `GET /api/v1/hospitais/ranking` ordenado por NOTA/TEMPO + filtro tipo + paginação) · ⬜ UI de ordenação no app → **Sprint S8** |
| **E4-06** | Tendência simples | **F-06** | 🔴 Pendente (não planejado no MVP atual) |

## Épico 5 — Conta, Consentimento e Privacidade
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E5-01** | Permissão localização etapas | **F-09** | 🟢 Implementado (FE: Perfil → Dados e Privacidade, consulta/solicita/revoga) |
| **E5-02** | Termos de privacidade LGPD | **F-09** | 🟢 Implementado (FE: tela Privacidade/Termos acessível em 2 toques; selo HIPAA removido) |
| **E5-03** | Histórico pessoal visitas/fb | **F-02** | 🔴 Pendente (**Sprint S8** — BE já expõe `GET /api/v1/usuarios/me/visitas`; falta UI do histórico + exportação CSV) |
| **E5-04** | Cadastro/login opcional | **F-02** | 🟢 Implementado (FE: conta opcional na jornada principal; Perfil orienta Login/Cadastro) |
| **E5-05** | Revogar consentimento LGPD | **F-09** | 🟡 Parcial (revogação em Perfil; desligamento nativo via configurações do SO → conclusão na **Sprint S8**) |

## Épico 6 — Experiência e Polimento (Cross)
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E6-01** | Navegação Bottom Tabs | **F-07** | 🟢 Implementado (S6: 3 abas Início/Hospitais/Perfil substituindo o Drawer; rotas de fluxo preservadas) |
| **E6-02** | Design System v2.0 | **F-08** | 🟢 Implementado (S6: tokens aplicados em Home/Perfil/Privacidade/GeoLocalização/Check-in; CSGeoStatusCard migrado; pacote Drawer removido) |
| **E6-03** | Acessibilidade AA | **F-08** | 🟢 Implementado (S6: labels/roles/alvos 48dp nas telas + tab bar acessível) |
| **E6-04** | Loading/Empty/Error states | **F-08** | 🟢 Implementado (S6: estados com retry na Home, Perfil e Check-in; tab bar testada em smoke test de UI) |
| **E6-05** | Notificações opt-in | **F-08** | 🟡 Parcial (opt-in de notificações no fluxo de feedback E3; ajuste dedicado de permissões fica para a **Sprint S8**) |

## Épico 7 — Painel Administrativo Web
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
