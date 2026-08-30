# 🗺️ Mapeamento De-Para: Backlog vs Features (MVP v2.0)

Este documento estabelece o mapeamento direto entre as **Estórias de Usuário (Backlog)** e as **Features** da arquitetura do MVP.

## Fase 0 — Estabilização e Segurança
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **F0-01** | Hash BCrypt para senhas | **F-02**, **F-09** | ✅ Existente (Seguro) |
| **F0-02** | Autenticação via JWT | **F-02** | ✅ Existente |
| **F0-03** | Padronizar envelope de erro | **F-09** | ✅ Existente |
| **F0-04** | Rate limiting | **F-09** | ⚠️ Pendente (login e endpoints públicos sem limite — planejado na sprint S6) |
| **F0-05** | Exclusão de conta (LGPD) | **F-02**, **F-09** | ⚠️ Pendente (endpoint protegido por auth, mas sem cascade de dados pessoais + anonimização de agregados) |

## Épico 1 — Cadastro de Hospitais e Geofences
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E1-01** | Cadastrar hospital (Admin) | **F-01** | ✅ Existente (Protegido Admin) |
| **E1-02** | Definir geofence (Admin) | **F-01** | ✅ Existente (Via endpoints Admin) |
| **E1-03** | Listar hospitais (Público) | **F-01**, **F-07** | ✅ Existente (340 importados) |
| **E1-04** | Editar/Desativar hospital | **F-01** | ✅ Existente |
| **E1-05** | Sugerir hospital | **F-07** | 🟡 Parcial (tela pública existe, endpoint público existe, mas sem moderação) |
| **E1-06** | Revisar/aprovar/rejeitar sugestão | **F-10** | 🔴 Inexistente |

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
| **E2-08** | Ignorar visitas < 2 minutos | **F-04** | ✅ Existente |
| **E2-09** | Enviar heartbeat 30 min | **F-03**, **F-04** | ✅ Existente |
| **E2-10** | Prompt observação/internação | **F-04** | ✅ Existente (após 12h) |

## Épico 3 — Feedback Pós-Saída
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E3-01** | Notificação de feedback 1-5m | **F-05** | ✅ Existente |
| **E3-02** | Form < 45s (4 perguntas) | **F-05** | ✅ Existente |
| **E3-03** | Responder em 24h + lembrete | **F-05** | ✅ Existente |
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
| **E4-05** | Ranking hospitais | **F-06** | 🟢 Implementado (BE: `GET /api/v1/hospitais/ranking` ordenado por NOTA/TEMPO + filtro tipo + paginação) |
| **E4-06** | Tendência simples | **F-06** | 🔴 Pendente (não planejado no MVP atual) |

## Épico 5 — Conta, Consentimento e Privacidade
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E5-01** | Permissão localização etapas | **F-09** | 🔴 Pendente |
| **E5-02** | Termos de privacidade LGPD | **F-09** | 🔴 Pendente |
| **E5-03** | Histórico pessoal visitas/fb | **F-02** | 🔴 Pendente (stretch) |
| **E5-04** | Cadastro/login opcional | **F-02** | 🔴 Pendente |
| **E5-05** | Revogar consentimento LGPD | **F-09** | 🔴 Pendente (stretch) |

## Épico 6 — Experiência e Polimento (Cross)
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E6-01** | Navegação Bottom Tabs | **F-07** | 🔴 Pendente (sprint S6) |
| **E6-02** | Design System v2.0 | **F-08** | 🔴 Pendente (sprint S6) |
| **E6-03** | Acessibilidade AA | **F-08** | 🔴 Pendente (sprint S6) |
| **E6-04** | Loading/Empty/Error states | **F-08** | 🔴 Pendente (sprint S6) |
| **E6-05** | Notificações opt-in | **F-08** | 🔴 Pendente (sprint S6) |

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
