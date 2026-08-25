# 📋 Backlog do MVP — Clinical Sanctuary v2.0

> **Backlog priorizado de produto para o MVP do monitoramento hospitalar por geolocalização**
>
> | Campo | Valor |
> |---|---|
> | **Versão** | 2.0 |
> | **Status** | Proposta de backlog — pronto para refinamento em cerimônias |
> | **Data** | 07/08/2026 |
> | **Autor** | Gabriel Vogado (Product Owner) |
> | **Referências** | Documento Negocial v2.0 (RN-01..RN-22) · Árvore Tecnológica v2.0 · Padrão UI/UX v2.0 |

---

## 1. Como ler este backlog

- **Prioridade (P0–P2)** segue o esquema **MoSCoW**: P0 = Must (MVP obrigatório) · P1 = Should (forte recomendado no MVP) · P2 = Could (pós-MVP).
- Cada estória traz: **ID**, **descrição**, **critérios de aceite (CA)** e **referência cruzada** às regras de negócio (RN) do Documento Negocial e aos requisitos (RF/RNF).
- **Estimativa** em pontos (S/M/L) é sugestiva — o time deve recalibrar.
- O backlog assume a **Fase 0 (estabilização de segurança)** da Árvore Tecnológica como pré-requisito.

---

## 2. Visão do MVP em uma frase

> Um app mobile que **detecta sozinho** quando o usuário entra e sai de um hospital, registra o tempo de permanência e convida a um **feedback de 4 perguntas em menos de 45 segundos**, publicando a nota média e o tempo médio de cada hospital para todos.

**Meta de lançamento (90 dias):** 1.000 usuários ativos semanais, ≥ 25% de taxa de resposta de feedback, 20 hospitais com avaliação pública válida (N ≥ 5).

---

## 3. Backlog priorizado

### Fase 0 — Estabilização e Segurança (pré-requisito) 🔥

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| F0-01 | P0 | Como sistema, devo **hashar senhas com BCrypt** ao cadastrar e autenticar, para não armazenar senha em texto puro. | CA: senha nunca é gravada em claro no banco; comparação via `PasswordEncoder`; teste unitário prova que o hash é irreversível. | RNF-05 |
| F0-02 | P0 | Como usuário, devo **autenticar via JWT** (access 15min + refresh 30d) para acessar endpoints protegidos. | CA: login retorna tokens; endpoint protegido rejeita sem token (401); refresh rotaciona token; logout revoga. | RNF-05, RF-06 |
| F0-03 | P0 | Como API, devo **padronizar o envelope de erro** (código, mensagem pt-BR, timestamp, traceId) para todas as respostas de erro. | CA: 100% dos erros usam o mesmo formato; `GlobalExceptionHandler` cobre validation, 404, 401, 403, 500. | RNF-05 |
| F0-04 | P1 | Como API, devo aplicar **rate limiting** em login e endpoints públicos para mitigar abuso. | CA: login > 10 req/min por IP retorna 429; agregados públicos > 60 req/min retornam 429. | RNF-05 |
| F0-05 | P0 | Como usuário, devo poder **excluir minha conta e dados pessoais** (direito LGPD). | CA: endpoint de exclusão remove usuário, auth e feedbacks vinculados; agregação anonimiza. | RN-21, RNF-06 |

---

### Épico 1 — Cadastro de Hospitais e Geofences 🏥

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| E1-01 | P0 | Como administrador, devo **cadastrar um hospital** com nome, endereço, tipo (público/privado), contato e status ativo. | CA: CRUD completo; nome e CNPJ únicos; campos obrigatórios validados com mensagem pt-BR. | RF-08, RN-21 |
| E1-02 | P0 | Como administrador, devo **definir a área geográfica (geofence) de um hospital** como polígono GeoJSON sobre o mapa. | CA: polígono válido (fechado, ≥ 3 vértices, sem auto-interseção); renderizado no mapa; salvo como `geofence` no documento. | RF-08, RN-01 |
| E1-03 | P0 | Como administrador, devo **listar hospitais ativos** para o app público (id, nome, tipo, geofence, indicadores). | CA: endpoint público retorna apenas hospitais ativos; geofence incluído para renderização; resposta < 300ms p95. | RF-05, RNF-02 |
| E1-04 | P1 | Como administrador, devo **editar/desativar** um hospital e seu geofence. | CA: edição valida polígono novamente; desativar remove do app público imediatamente. | RF-08 |
| E1-05 | P1 | Como usuário, devo **sugerir a inclusão de um hospital** não cadastrado (endpoint público de sugestão). | CA: sugestão cria registro pendente de aprovação; sem custo para o usuário anônimo. | RF-05 |
| **E1-06** | P1 | Como administrador, devo **revisar, aprovar e rejeitar sugestões públicas** de hospitais para manter a qualidade e confiabilidade do cadastro oficial. | CA: listagem paginada filtrável por status (`PENDENTE`, `APROVADA`, `RECUSADA`); detalhe da sugestão; aprovação vincula a um hospital criado; rejeição exige motivo; transições apenas `PENDENTE → APROVADA` e `PENDENTE → RECUSADA`; endpoints protegidos para `ADMIN`; tela de fila de moderação no app; audit trail de quem decidiu e quando. | E1-05 |

---

### Épico 2 — Detecção de Visitas (Geofence) 📍

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| E2-01 | P0 | Como usuário, devo **ter minha entrada detectada automaticamente** ao permanecer ≥ 2 minutos dentro de um geofence hospitalar. | CA: evento de entrada registra `VISITA.EM_ATENDIMENTO`; nenhuma ação manual necessária; card "Você está em X" exibido. | RN-01, RF-01, P1 |
| E2-02 | P0 | Como usuário, devo **ter minha saída detectada** após 5 minutos fora do geofence, encerrando a visita e gravando o tempo de permanência. | CA: evento de saída encerra visita com `saida` e `duracao_minutos`; saídas curtas (< 5min) não encerram. | RN-03, RF-02 |
| E2-03 | P0 | Como sistema, devo **expirar visitas presas apenas após 24h sem heartbeat** (não por tempo de permanência — esperas reais de 12h+ no SUS não podem ser cortadas). | CA: job de expiração roda periodicamente (ex.: 15min); visita com `ultimoHeartbeat` > 24h vira `EXPIRADA`; tempo parcial preservado; visita com heartbeats regulares permanece ativa indefinidamente. | RN-04, RN-23 |
| E2-04 | P0 | Como sistema, devo **tratar conflito de áreas sobrepostas** escolhendo o hospital mais próximo. | CA: com 2 geofences contendo o ponto, escolhe a menor distância; se empate persistir, app pergunta em 1 toque. | RN-05 |
| E2-05 | P1 | Como sistema, devo **recuperar visitas com GPS interrompido** por até 10 minutos. | CA: falha de GPS não encerra a visita imediatamente; após 10 min sem sinal, encerra com `GPS_INTERROMPIDO`. | RN-06 |
| E2-06 | P0 | Como usuário com GPS desligado/permissão negada, devo poder **fazer check-in manual em 1 toque** como plano B. | CA: botão "Estou em um hospital" na home; seleção do hospital; visita manual com flag `manual=true`. | P1, P9, UI/UX §5 |
| E2-07 | P0 | Como usuário, devo **ver minha visita ativa** (hospital + cronômetro) sem precisar abrir o app durante a permanência. | CA: card de visita ativa na home e notificação silenciosa persistente; atualização a cada minuto. | RF-02, UI/UX TimerBanner |
| E2-08 | P1 | Como sistema, devo **ignorar visitas < 2 minutos** nas estatísticas públicas. | CA: filtro aplicado na agregação; visita curta permanece no histórico do usuário, mas não entra no agregado. | RN-07, RN-17 |
| E2-09 | P0 | Como app, devo **enviar heartbeat a cada 30 minutos** enquanto houver visita ativa. | CA: heartbeat registra `ultimoHeartbeat`; ausência de 2h marca visita `SUSPEITA`; heartbeat retoma status `EM_ATENDIMENTO`; consumo de rede/bateria validado em teste de campo. | RN-23, RF-02 |
| E2-10 | P1 | Como usuário, devo **sinalizar em 1 toque se estou em observação ou internado** após 12h de visita ativa. | CA: prompt aparece aos 12h; escolha grava `tipoPermanencia = OBSERVACAO|INTERNACAO`; visita sai da métrica de tempo de pronto-atendimento, permanece no histórico; se ignorar, segue contabilizada normalmente. | RN-24, E4-02 |

---

### Épico 3 — Feedback Pós-Saída 📝

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| E3-01 | P0 | Como usuário, devo **receber a notificação de feedback entre 1 e 5 minutos após a saída**. | CA: notificação local dispara após saída + delay configurável (1–5min); nunca dispara dentro do geofence. | RN-08, RF-04 |
| E3-02 | P0 | Como usuário, devo **responder o feedback com até 4 perguntas em < 45s**, com progresso visível e botão "Pular" sempre presente. | CA: pergunta 1 (foi atendido?) → se "não", pula para nota; pergunta 2 (médico disponível?); pergunta 3 (fez triagem?); pergunta 4 (nota 1–5); chips de medicação/receita; comentário opcional; envio com nota apenas. | RN-10, RN-11, RF-04, P2 |
| E3-03 | P0 | Como usuário, devo **responder o feedback em até 24h**, com no máximo 1 lembrete. | CA: após 24h, visita vira `SEM_FEEDBACK`; lembrete único disparado ~6h após a primeira notificação; nenhum incômodo além disso. | RN-09, P3 |
| E3-04 | P0 | Como sistema, devo **bloquear feedback duplicado por visita**. | CA: 1 feedback por visita (unique index em `feedback.visita_id`); tentativa duplicada retorna erro amigável. | RN-12 |
| E3-05 | P0 | Como usuário anônimo, devo **responder o feedback sem login**. | CA: fluxo anônimo funciona de ponta a ponta; feedback gravado com `usuario_id` nulo; dados não expõem identidade. | RN-13, RN-20, RF-04 |
| E3-06 | P1 | Como usuário, devo **ver agradecimento e impacto** após enviar ("Sua avaliação ajuda X pessoas por semana"). | CA: tela de sucesso com mensagem; link para ver a nota atualizada do hospital. | P4, UI/UX §9 |

---

### Épico 4 — Indicadores Públicos por Hospital 📊

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| E4-01 | P0 | Como cidadão, devo **ver a nota média de um hospital** (1–5) calculada dos feedbacks válidos dos últimos 90 dias. | CA: média aritmética; exibida apenas com N ≥ 5; caso contrário "Ainda sem avaliações suficientes". | RN-14, RN-15, RF-03 |
| E4-02 | P0 | Como cidadão, devo **ver o tempo médio de atendimento** (mediana das visitas finalizadas de pronto-atendimento, até 24h, excluindo internação/observação) do hospital. | CA: mediana, não média; inclui filas reais de 12h+ (teto de 24h); exclui visitas com `tipoPermanencia = INTERNACAO|OBSERVACAO`; exibido com N ≥ 5 no período. | RN-16, RN-17, RN-24, RF-03 |
| E4-03 | P0 | Como cidadão, devo **ver o detalhe público do hospital**: nota, tempo médio, N, período e data da última atualização. | CA: tela pública carrega em < 2s (p95); transparência metodológica visível; sem dados pessoais. | RN-19, RNF-02 |
| E4-04 | P0 | Como sistema, devo **atualizar os agregados em até 15 minutos** após novo feedback. | CA: job/evento recalcula agregado; leitura pública sempre servida do agregado materializado. | RN-18 |
| E4-05 | P1 | Como cidadão, devo **ver a lista/ranking de hospitais** ordenável por nota e por tempo médio. | CA: ordenação funcional; filtro por tipo (público/privado) — se aprovado no refinamento; paginação. | RF-05, UI/UX Pergunta aberta §12 |
| E4-06 | P2 | Como cidadão, devo **ver tendência simples** (comparativo de nota do período anterior). | CA: comparação com período anterior exibida se houver dados suficientes; badge "preliminar" quando N < 10. | UI/UX §5 |

---

### Épico 5 — Conta, Consentimento e Privacidade 🔐

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| E5-01 | P0 | Como usuário, devo **conceder permissão de localização em etapas** com explicação clara e poder revogar. | CA: onboarding explica uso antes de pedir; permissão negada não bloqueia consulta pública; revogação em Perfil → Dados e Privacidade. | RN-21, RNF-06, P5 |
| E5-02 | P0 | Como usuário, devo **aceitar termos e política de privacidade** em linguagem simples no onboarding. | CA: aceite registrado com data/versão; política acessível em 2 toques; menção LGPD, sem selo HIPAA. | RN-21, UI/UX §8 |
| E5-03 | P0 | Como usuário logado, devo **ver meu histórico de visitas e feedbacks** (somente os meus). | CA: lista paginada; apenas dados do próprio usuário; exportação de dados pessoais disponível. | RN-22, RNF-06, RF-06 |
| E5-04 | P0 | Como usuário, devo **cadastrar/login opcional** (e-mail + senha) para acessar histórico e perfil. | CA: cadastro via API v2 com hash (F0-01); login JWT (F0-02); conta não obrigatória para jornada principal. | RN-20, RF-06 |
| E5-05 | P1 | Como usuário, devo **revogar consentimento de geolocalização** sem perder acesso ao restante do app. | CA: ao revogar, monitoramento para; visitas ativas encerradas; app continua funcionando em modo manual. | RN-21, P5 |

---

### Épico 6 — Experiência e Polimento (Cross) ✨

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| E6-01 | P0 | Como usuário, devo **navegar por Bottom Tabs** (Mapa, Hospitais, Perfil) conforme o novo padrão de navegação. | CA: navegação de 1 polegar; substituição do Drawer; telas existentes (Login/Cadastro) integradas ao fluxo. | UI/UX §4, P6 |
| E6-02 | P0 | Como usuário, devo **usar o Design System v2.0** (tokens, tipografia, componentes) em todas as telas do app. | CA: tokens aplicados (cores, raios, sombras); componentes do padrão (Button, RatingStars, FeedbackSheet etc.); remoção de assets antigos (GIF/PNG); selos LGPD no lugar de HIPAA. | UI/UX §5–6 |
| E6-03 | P1 | Como usuário com deficiência, devo **usar o app com leitor de tela e contraste AA**. | CA: roles/labels de acessibilidade; alvos ≥ 48dp; contraste verificado; navegação por teclado em web. | RNF-08, P8 |
| E6-04 | P1 | Como usuário, devo **ver estados de carregamento/vazio/erro** em todas as telas. | CA: LoadingState em carregamentos; EmptyState quando sem dados; erro com ação de retry. | UI/UX §5 |
| E6-05 | P2 | Como usuário, devo **receber notificações locais com permissão explicada** (não obrigatória). | CA: opt-in claro; notificação de feedback e de visita ativa; desativar em Perfil. | RN-08, RNF-06 |

---

## 4. Sequência de entrega sugerida (sprints)

> Sugestão de 6 sprints de 2 semanas (12 semanas). Recalibrar com a equipe.

| Sprint | Foco | Estórias |
|---|---|---|
| **S0 (pré)** | Segurança e fundações | F0-01, F0-02, F0-03, F0-05 |
| **S1** | Hospitais + geofence admin + moderação de sugestões | E1-01, E1-02, E1-03, E1-04, E1-05, E1-06 |
| **S2** | Detecção de visitas (mobile + backend) | E2-01, E2-02, E2-06, E2-07, E2-09 |
| **S3** | Robustez de visitas + feedback backend | E2-03, E2-04, E2-05, E2-10, E3-04, E3-05 |
| **S4** | Feedback mobile + notificações | E3-01, E3-02, E3-03, E3-06 |
| **S5** | Indicadores públicos + conta/privacy | E4-01..E4-04, E5-01, E5-02, E5-04 |
| **S6** | Polimento + lançamento | E6-01..E6-04, E4-05, F0-04, E5-03, E5-05 |

---

## 5. Definição de Pronto (DoD) — MVP

- ✅ Código revisado e mergeado na `main`;
- ✅ Testes unitários dos serviços críticos (visita, agregação, auth) com cobertura ≥ 70% nas regras de negócio;
- ✅ Contratos de API documentados (OpenAPI) e testados via testes de integração;
- ✅ Verificação de acessibilidade (WCAG AA) nas telas novas;
- ✅ Consentimento LGPD implementado e testado (permissões + exclusão de conta);
- ✅ Teste de campo de geofence realizado em ≥ 3 hospitais reais (calibragem de raio/tolerâncias);
- ✅ Métricas de produto instrumentadas (taxa de resposta, tempo de resposta, abandono).

---

## 6. Estórias fora do MVP (backlog futuro)

| ID | Estória | Fase |
|---|---|---|
| FUT-01 | Painel institucional para gestores (agregados + alertas de queda de nota) | Fase 2 |
| FUT-02 | Integração com sistemas internos de hospitais via API | Fase 2 |
| FUT-03 | Relatórios agregados para poder público | Fase 3 |
| FUT-04 | Busca avançada com filtros (tipo, região, especialidade) | Fase 2 |
| FUT-05 | Comparação lado a lado de 2+ hospitais | Fase 2 |
| FUT-06 | Modo escuro e personalização de notificações | Fase 2 |
| FUT-07 | Teleconsulta e pagamentos (visão v1.0 SAS) | Fase 3 |

---

## 7. Dependências críticas

1. **Fase 0 (segurança) antes de qualquer endpoint público** — nunca expor API sem auth/hash.
2. **E1 (hospitais) antes de E2 (visitas)** — geofence depende de hospital cadastrado.
3. **E2 antes de E3 (feedback)** — feedback depende de visita encerrada.
4. **E3 antes de E4 (agregados)** — agregado depende de feedbacks válidos.
5. **E2-09 (heartbeat) antes de E2-03 (expiração)** — a expiração por 24h sem sinal só faz sentido com heartbeat implementado; ambos no mesmo sprint.
6. **Teste de campo de geofence** antes de fechar o S2/S3 — calibra RN-01/RN-03, intervalo de heartbeat (RN-23) e o raio (proposta 100–150m), incluindo cenário de espera longa (visita ativa > 12h).

---

*Fim do Backlog do MVP v2.0 — refinamento com o time antes do Sprint 0.*
