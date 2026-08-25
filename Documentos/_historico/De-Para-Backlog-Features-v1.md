# 🗺️ Mapeamento De-Para: Backlog vs Features (MVP v2.0)

Este documento estabelece o mapeamento direto entre as **Estórias de Usuário (Backlog)** e as **Features** da arquitetura do MVP.

## Fase 0 — Estabilização e Segurança
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **F0-01** | Hash BCrypt para senhas | **F-02**, **F-09** | ⚠️ Senha em texto puro atual |
| **F0-02** | Autenticação via JWT | **F-02** | ⚠️ Falta JWT |
| **F0-03** | Padronizar envelope de erro | **F-09** | 🔴 Inexistente |
| **F0-04** | Rate limiting | **F-09** | 🔴 Inexistente |
| **F0-05** | Exclusão de conta (LGPD) | **F-02**, **F-09** | 🔴 Inexistente |

## Épico 1 — Cadastro de Hospitais e Geofences
| ID Backlog | Estória | Feature(s) Relacionada(s) | Status Implementação |
|---|---|---|---|
| **E1-01** | Cadastrar hospital (Admin) | **F-01** | 🔴 Inexistente |
| **E1-02** | Definir geofence (Admin) | **F-01** | 🔴 Inexistente |
| **E1-03** | Listar hospitais (Público) | **F-01**, **F-07** | 🔴 Inexistente |
| **E1-04** | Editar/Desativar hospital | **F-01** | 🔴 Inexistente |
| **E1-05** | Sugerir hospital | **F-07** | 🔴 Inexistente |

## Épico 2 — Detecção de Visitas (Geofence)
| ID Backlog | Estória | Feature(s) Relacionada(s) |
|---|---|---|
| **E2-01** | Detecção entrada automática | **F-03** |
| **E2-02** | Detecção saída automática | **F-03** |
| **E2-03** | Expirar visitas > 24h | **F-03** |
| **E2-04** | Tratar conflito sobreposição | **F-03** |
| **E2-05** | Recuperar GPS interrompido | **F-03** |
| **E2-06** | Check-in manual (Plano B) | **F-04** |
| **E2-07** | Ver visita ativa (app) | **F-04** |
| **E2-08** | Ignorar visitas < 2 minutos | **F-04** |
| **E2-09** | Enviar heartbeat 30 min | **F-03**, **F-04** |
| **E2-10** | Prompt observação/internação | **F-04** |

## Épico 3 — Feedback Pós-Saída
| ID Backlog | Estória | Feature(s) Relacionada(s) |
|---|---|---|
| **E3-01** | Notificação de feedback 1-5m | **F-05** |
| **E3-02** | Form < 45s (4 perguntas) | **F-05** |
| **E3-03** | Responder em 24h + lembrete | **F-05** |
| **E3-04** | Bloquear feedback duplicado | **F-05** |
| **E3-05** | Feedback anônimo | **F-05** |
| **E3-06** | Agradecimento e impacto | **F-05** |

## Épico 4 — Indicadores Públicos por Hospital
| ID Backlog | Estória | Feature(s) Relacionada(s) |
|---|---|---|
| **E4-01** | Ver nota média do hospital | **F-06** |
| **E4-02** | Ver tempo médio do hospital | **F-06** |
| **E4-03** | Detalhe público hospital | **F-06** |
| **E4-04** | Atualizar agregados 15min | **F-06** |
| **E4-05** | Ranking hospitais | **F-06** |
| **E4-06** | Tendência simples | **F-06** |

## Épico 5 — Conta, Consentimento e Privacidade
| ID Backlog | Estória | Feature(s) Relacionada(s) |
|---|---|---|
| **E5-01** | Permissão localização etapas | **F-09** |
| **E5-02** | Termos de privacidade LGPD | **F-09** |
| **E5-03** | Histórico pessoal visitas/fb | **F-02** |
| **E5-04** | Cadastro/login opcional | **F-02** |
| **E5-05** | Revogar consentimento LGPD | **F-09** |

## Épico 6 — Experiência e Polimento (Cross)
| ID Backlog | Estória | Feature(s) Relacionada(s) |
|---|---|---|
| **E6-01** | Navegação Bottom Tabs | **F-07** |
| **E6-02** | Design System v2.0 | **F-08** |
| **E6-03** | Acessibilidade AA | **F-08** |
| **E6-04** | Loading/Empty/Error states | **F-08** |
| **E6-05** | Notificações opt-in | **F-08** |
