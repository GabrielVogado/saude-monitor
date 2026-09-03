# 📋 Backlog do MVP — Clinical Sanctuary v2.1

> **Backlog priorizado de produto para o MVP do monitoramento hospitalar por geolocalização**
>
> | Campo | Valor |
> |---|---|
> | **Versão** | 2.1 |
> | **Status** | Vigente — reordenado em 02/09/2026 após as decisões de priorização do Product Owner |
> | **Data** | 07/08/2026 · **Revisão v2.1:** 02/09/2026 |
> | **Autor** | Gabriel Vogado (Product Owner) |
> | **Referências** | Documento Negocial v2.0 (RN-01..RN-24) · Árvore Tecnológica v2.0 · Padrão UI/UX v2.0 · `Features-MVP-v2.1.md` · `08-analise tecnica/Consolidacao-Tecnica-e-Backlog-Pendente-v1.1.md` |
> | **O que mudou na v2.1** | (1) Novo **Épico 8 — Estabilização, Desempenho e Qualidade**, com as pendências que nenhum documento cobria até aqui; (2) **Épico 7 (Painel Admin Web) rebaixado de P0 para P2** e retirado do caminho crítico, por decisão do PO; (3) §4 (sequência de sprints) atualizada com o que de fato ocorreu em S0–S8 e com o replanejamento S9–S12; (4) §5 (DoD) passa a registrar a situação real de cada critério em vez de listar desejos. |

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

## 2.1 Decisões de priorização vigentes (02/09/2026)

Três decisões do Product Owner reordenam este backlog. Ficam registradas aqui por serem a razão de o Épico 7 sair do caminho crítico e de o Épico 8 existir.

| # | Decisão (registro literal) | Efeito no backlog |
|---|---|---|
| **D-01** | *"O Painel ADMIN ainda não é prioritário, será desenvolvido depois que o app estiver todo desenvolvido sem pendências, nem débitos técnicos."* | **Épico 7 (E7-01..E7-09) passa de P0 para P2** e sai da sequência de sprints ativa. Sua condição de entrada é: Épico 8 fechado, zero débitos técnicos e V-01..V-09 executadas. |
| **D-02** | *"Os testes de campo ainda não são possíveis de serem executados... o sistema ainda não está pronto para realizar testes de campo."* | As validações **V-01, V-02, V-06 e V-09** (`Features-MVP-v2.1.md` §11) ficam **bloqueadas**, e com elas o critério de DoD "teste de campo de geofence em ≥ 3 hospitais reais" (§5). Desbloqueá-las é o objetivo do Épico 8. |
| **D-03** | *"Os documentos não foram atualizados no decorrer do desenvolvimento."* | Motiva esta revisão v2.1 e as versões irmãs (`Features-MVP-v2.1.md`, `Plano-Sprints-v2.1.md`, `De-Para-Backlog-Features.md`). Passa a valer a regra operacional do §8. |

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
| E2-06 | P0 | Como usuário, devo **fazer check-in manual em 1 toque** (caminho de primeira classe), selecionando o hospital da lista — essencial com GPS desligado, permissão negada ou iOS restritivo. | CA: botão "Estou em um hospital" na home/lista; seleção do hospital; visita manual com flag `manual=true`. | P1, P9, UI/UX §5 |
| E2-07 | P0 | Como usuário, devo **ver minha visita ativa** (hospital + cronômetro) sem precisar abrir o app durante a permanência. | CA: card de visita ativa na home e notificação silenciosa persistente; atualização a cada minuto. | RF-02, UI/UX TimerBanner |
| E2-08 | P1 | Como sistema, devo **ignorar visitas < 2 minutos** nas estatísticas públicas. | CA: filtro aplicado na agregação; visita curta permanece no histórico do usuário, mas não entra no agregado. | RN-07, RN-17 |
| E2-09 | P0 | Como app, devo **enviar heartbeat a cada 30 minutos** enquanto houver visita ativa. | CA: heartbeat registra `ultimoHeartbeat`; ausência de 2h marca visita `SUSPEITA`; heartbeat retoma status `EM_ATENDIMENTO`; consumo de rede/bateria validado em teste de campo. | RN-23, RF-02 |
| E2-10 | P1 | Como usuário, devo **sinalizar em 1 toque se estou em observação ou internado** após 12h de visita ativa. | CA: prompt aparece aos 12h; escolha grava `tipoPermanencia = OBSERVACAO|INTERNACAO`; visita sai da métrica de tempo de pronto-atendimento, permanece no histórico; se ignorar, segue contabilizada normalmente. | RN-24, E4-02 |

---

### Épico 3 — Feedback Pós-Saída 📝

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| E3-01 | P0 | Como usuário, devo **receber a notificação de feedback entre 1 e 5 minutos após a saída**. | CA: notificação local dispara após saída + delay configurável (1–5min); nunca dispara dentro do geofence. | RN-08, RF-04 |
| E3-02 | P0 | Como usuário, devo **responder o feedback em até 4 telas (< 45s)**, com progresso visível e botão "Pular" sempre presente, seguindo o fluxo ramificado abaixo. | **Fluxo de 4 telas (máx.) — ramificação invisível ao usuário:**<br/><br/>**Tela 1 — Triagem**<br/>• "Você passou pela triagem ao chegar na unidade?"<br/>• ✅ Sim → **Tela 2**<br/>• ❌ Não → **Tela 3** (pula especialidade)<br/><br/>**Tela 2 — Especialidade procurada + Atendimento** (só se triagem = Sim)<br/>• "Qual especialidade você procurava?" → select searchable (lista CNES/DATASUS)<br/>• "Conseguiu ser atendido por médico(a) desta especialidade?"<br/>  - ✅ Sim → **Tela 3**<br/>  - ❌ Não → **motivo** (radio obrigatório):<br/>    🔴 **LOTACAO** — Superlotação / espera excessiva<br/>    👨‍⚕️ **FALTA_MEDICO** — Falta de médico na especialidade<br/>    ⚪ **CLASSIFICACAO_RISCO** — Prioridade a casos mais graves (Protocolo Manchester: Vermelho/Laranja)<br/>    🚪 **OUTRO** — campo curto opcional<br/>• → **Tela 3**<br/><br/>**Tela 3 — Tratamento pela equipe** (sempre exibida)<br/>• "Como foi o tratamento dos funcionários da unidade com você?"<br/>• Escala 5 pontos + "Não interagi": Muito bem / Bem / Regular / Mal / Muito mal / Não interagi<br/>• → **Tela 4**<br/><br/>**Tela 4 — Nota geral + Comentário** (sempre exibida)<br/>• "De 1 a 5, como avalia sua experiência geral hoje?" → ★★★★★<br/>• "Quer deixar algum comentário?" (opcional, max 500 chars)<br/>• Botão "Enviar"<br/><br/>**Regras transversais:**<br/>• `especialidadeProcurada` **sempre capturada** se triagem = Sim (mesmo se não atendido) → permite indicador de "falta de médico por especialidade"<br/>• `motivoNaoAtendido = CLASSIFICACAO_RISCO` **não é gap** — card "Fluxo Correto" no painel admin (verde)<br/>• `motivoNaoAtendido = FALTA_MEDICO` → gap RH (vermelho no painel)<br/>• `motivoNaoAtendido = LOTACAO` → gap Capacidade/Fluxo (laranja no painel)<br/>• Frontend mostra label amigável `CASOS_MAIS_GRAVES_PRIORIDADE`; backend normaliza para `CLASSIFICACAO_RISCO`<br/>• Comentário opcional único no final; zero caixas de texto obrigatórias<br/>• Persistência local a cada tela; envio único no final (`POST /api/v1/feedback` com `visitaId`) | RN-10, RN-11, RF-04, P2 |
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
| E6-01 | P0 | Como usuário, devo **navegar por Bottom Tabs** (Início, Hospitais, Mapa, Perfil) conforme o novo padrão de navegação. | CA: navegação de 1 polegar; substituição do Drawer; telas existentes (Login/Cadastro) integradas ao fluxo. | UI/UX §4, P6 |
| E6-02 | P0 | Como usuário, devo **usar o Design System v2.0** (tokens, tipografia, componentes) em todas as telas do app. | CA: tokens aplicados (cores, raios, sombras); componentes do padrão (Button, RatingStars, FeedbackSheet etc.); remoção de assets antigos (GIF/PNG); selos LGPD no lugar de HIPAA. | UI/UX §5–6 |
| E6-03 | P1 | Como usuário com deficiência, devo **usar o app com leitor de tela e contraste AA**. | CA: roles/labels de acessibilidade; alvos ≥ 48dp; contraste verificado; navegação por teclado em web. | RNF-08, P8 |
| E6-04 | P1 | Como usuário, devo **ver estados de carregamento/vazio/erro** em todas as telas. | CA: LoadingState em carregamentos; EmptyState quando sem dados; erro com ação de retry. | UI/UX §5 |
| E6-05 | P2 | Como usuário, devo **receber notificações locais com permissão explicada** (não obrigatória). | CA: opt-in claro; notificação de feedback e de visita ativa; desativar em Perfil. | RN-08, RNF-06 |

---

### Épico 7 — Painel Administrativo Web 🖥️ · ⏸️ **ADIADO (P2)**

> ⏸️ **Decisão D-01 (02/09/2026) — este épico está fora do caminho crítico.** Prioridade rebaixada de **P0 para P2**. Registro literal do Product Owner: *"O Painel ADMIN ainda não é prioritário, será desenvolvido depois que o app estiver todo desenvolvido sem pendências, nem débitos técnicos."*
>
> **Condição de entrada (as três, cumulativas):** (1) Épico 8 concluído; (2) zero débitos técnicos abertos no app; (3) validações V-01..V-09 executadas com sucesso. Até lá, a gestão administrativa continua sendo feita pelos endpoints REST protegidos por `ADMIN` e pelas telas legadas de moderação no app. O `Plano-Tecnico-Painel-Administrativo-Web-v1.0.md` permanece válido como proposta e **não deve ser executado** antes desse marco.
>
> **Contexto original:** por ser um aplicativo comunitário direcionado à população, o acesso administrativo **não fica no app mobile**. Toda a gestão (hospitais, sugestões, georreferenciamento) passa a ser feita por uma **aplicação web** dedicada ao administrador, consumindo os mesmos endpoints REST do backend (E1, E1-06). O app mobile permanece exclusivamente para o cidadão.

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. |
|---|---|---|---|---|
| E7-01 | P0 | Como administrador, devo **acessar uma aplicação web dedicada** com login administrativo (papel `ADMIN`), para gerenciar o sistema sem depender do app mobile da população. | CA: tela de login web autentica via `POST /auth/login` e exige papel `ADMIN`; usuário sem papel `ADMIN` é rejeitado; sessão mantém JWT (access + refresh). | RF-08, RNF-05 |
| E7-02 | P0 | Como administrador, devo **listar todos os hospitais cadastrados** (ativos e inativos), para ter visão completa da rede. | CA: listagem paginada consome `GET /hospitais` (incluindo inativos, exclusivo para admin); exibe nome, tipo, status, região administrativa; ordenável. | E1-03, RF-08 |
| E7-03 | P0 | Como administrador, devo **filtrar os hospitais** por nome, tipo, status (ativo/inativo) e por Região Administrativa, Região de Saúde ou Macrorregião de Saúde, para localizar rapidamente uma unidade. | CA: filtros combináveis; resultado atualiza lista e mapa; filtro por região usa o dado georreferenciado da camada correspondente. | RF-08 |
| E7-04 | P0 | Como administrador, devo **visualizar os hospitais em um mapa** com camadas sobrepostas de **Região Administrativa**, **Região Integrada de Desenvolvimento**, **Regiões de Saúde** e **Macrorregiões de Saúde**, para entender a distribuição geográfica da rede. | CA: mapa renderiza os 4 polígonos de divisão administrativa/saúde como camadas independentes (toggle liga/desliga cada camada); pins de hospitais sobrepostos; dados de origem: `D:\saude-monitor\multiplas_camadas_saude_14` (convertidos para GeoJSON). | RF-08 |
| E7-05 | P0 | Como administrador, devo **tocar/clicar no ícone de um hospital no mapa** e ser redirecionado à tela de detalhe daquela unidade, para consultar todos os seus dados cadastrais. | CA: clique no pin abre a tela de detalhe do hospital (`GET /hospitais/{id}`) com todos os campos cadastrais; hospitais inativos aparecem no mapa com **ícone cinza**. | E1-01, RF-08 |
| E7-06 | P0 | Como administrador, devo **editar os dados cadastrais de um hospital** (nome, endereço, tipo, contato, geofence), para manter o cadastro atualizado. | CA: formulário de edição consome `PUT /hospitais/{id}`; revalida geofence (polígono fechado, ≥ 3 vértices); **não expõe nem permite alterar dados de feedback** dos usuários (somente leitura, se exibido, ou não exibido nesta tela). | E1-04, RF-08 |
| E7-07 | P0 | Como administrador, devo **desativar um hospital**, para que ele deixe de aparecer no app público e passe a ser sinalizado no mapa administrativo com **ícone cinza** indicando inatividade. | CA: ação consome `PATCH /hospitais/{id}/status`; hospital desativado some do app público (E1-04) e some do app da população; no painel web, permanece visível no mapa/lista com marcador cinza distinto do marcador ativo (colorido). | E1-04, RF-08 |
| E7-08 | P0 | Como administrador, **não devo poder alterar dados de feedback** dos usuários em nenhuma tela do painel, para preservar a integridade e a imparcialidade das avaliações públicas. | CA: nenhum endpoint de escrita de feedback (`PUT /feedbacks/{id}`) é exposto ao papel `ADMIN`; tela de detalhe do hospital, se exibir indicadores/feedbacks, apresenta-os apenas como leitura (somente exibição agregada). | RN-19, RN-22 |
| E7-09 | P1 | Como administrador, devo **navegar por um menu** com as opções "Hospitais" (lista) e "Mapa", além do acesso à fila de moderação de sugestões (E1-06), para alternar entre as visões administrativas. | CA: menu lateral/topo fixo em todas as telas autenticadas; opção "Mapa" abre a visualização georreferenciada (E7-04); opção "Hospitais" abre a listagem (E7-02); item "Sugestões pendentes" reaproveita os endpoints de E1-06. | E1-06, RF-08 |

---

### Épico 8 — Estabilização, Desempenho e Qualidade 🩺

> **Contexto (02/09/2026):** o app está funcionalmente completo (42 das 43 estórias do escopo mobile), mas **não é utilizável** — a primeira abertura após ociosidade leva **109 s e retorna HTTP 503**, e mesmo com o serviço quente há **1 a 5 s por requisição**, o que explica a lentidão relatada de forma idêntica em login, lista, cadastro e envio de feedback. Este épico existe para transformar "implementado" em "utilizável", e é **pré-requisito de qualquer teste de campo e do Épico 7**.
>
> A coluna **Ref. consolidação** aponta o item equivalente em `08-analise tecnica/Consolidacao-Tecnica-e-Backlog-Pendente-v1.1.md`, para não duplicar rastreabilidade.

#### 8.A — Desempenho (bloqueia o teste de campo)

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. consolidação |
|---|---|---|---|---|
| E8-01 | **P0** | Como usuário, devo **abrir o app e ver a lista em poucos segundos, mesmo sendo o primeiro usuário do dia**, sem tela de erro. | CA: a primeira requisição após ≥ 30 min de ociosidade responde **< 5 s** e **nunca com 5xx**; medição registrada antes e depois. Requer decidir entre (a) plano pago no Render sem *spin-down*, (b) *keep-alive* agendado no `/actuator/health`, ou (c) outro provedor — **(b) é paliativo e não resolve a CPU compartilhada**. | OPS-01 |
| E8-02 | **P0** | Como sistema, devo **cumprir o orçamento de latência do RNF-02** nos endpoints públicos. | CA: p95 de `GET /hospitais` e `GET /hospitais/{id}/indicadores` **< 300 ms** com o serviço quente (hoje: 1,9–4,9 s); medição reproduzível documentada. | OPS-01, ARQ-05 |
| E8-03 | **P0** | Como app, devo **receber apenas os dados necessários** na listagem de hospitais. | CA: a resposta de `GET /hospitais` **não traz o polígono da geofence** (hoje são 35 KB para 20 itens); o polígono é buscado sob demanda pelo mapa/detalhe; contrato ajustado na `Especificacao-API`. | ARQ-05 |
| E8-04 | **P0** | Como usuário, devo **saber que o app está carregando ou que o servidor está indisponível**, em vez de encarar uma tela parada. | CA: todo acesso de rede tem **timeout explícito**; > 2 s exibe estado de carregamento; falha exibe mensagem acionável com *retry*; a mensagem distingue "sem internet" de "servidor indisponível". | OPS-05, E6-04 |
| E8-05 | **P0** | Como time, devo **ter o inventário dos bugs observados** para tratá-los com prioridade e critério, em vez de por relato. | CA: cada bug relatado vira uma issue com passos de reprodução, evidência (log/print) e severidade; a lista fecha antes de S9 encerrar. **Depende de insumo do PO** — os bugs foram observados em uso e não estão registrados em nenhum documento. | — (novo) |

#### 8.B — Confiabilidade e observabilidade

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. consolidação |
|---|---|---|---|---|
| E8-06 | P1 | Como time, devo **medir latência e taxa de erro por endpoint** para não depender de relato subjetivo de lentidão. | CA: métricas de p50/p95/p99 e taxa de 5xx expostas e visíveis em painel; alerta quando o p95 estourar o orçamento do RNF-02. | OPS-04 |
| E8-07 | P1 | Como time, devo **receber os *crashes* do app** com *stack trace* e versão. | CA: ferramenta de *crash reporting* integrada ao app; um *crash* forçado aparece no painel em < 5 min. | ENG-03 |
| E8-08 | P1 | Como time, devo **medir a cobertura de testes** exigida pelo DoD (≥ 70% nas regras de negócio). | CA: cobertura medida no backend e no frontend, publicada no CI e falhando abaixo do limiar acordado. | DOD-01 |
| E8-09 | P1 | Como consumidor da API, devo **ter o contrato publicado em OpenAPI**. | CA: especificação gerada automaticamente e servida pela aplicação; cobre os 31 endpoints REST atuais. | DOD-02 |
| E8-10 | P1 | Como time, devo **ter testes de integração com contexto Spring real**, e não apenas testes de controller isolados. | CA: ao menos os fluxos críticos (auth, check-in/check-out, feedback, agregação) cobertos com contexto completo e banco de teste. | DOD-03 |
| E8-11 | P2 | Como Product Owner, devo **medir o funil do produto** (taxa de resposta de feedback, abandono, retenção). | CA: eventos instrumentados no app; os KPIs do §2 deste backlog passam a ser aferíveis. | DOD-05 |

#### 8.C — Esteira e integridade de contrato

| ID | Prioridade | Estória | Critérios de aceite (CA) | Ref. consolidação |
|---|---|---|---|---|
| E8-12 | **P0** | Como time, devo **rodar os testes do frontend na esteira**, para que um PR quebrado não seja aprovado. | CA: o job de frontend do `ci.yml` executa `npm test` (hoje executa apenas `npm run typecheck` e `expo export`); PR com teste falhando fica bloqueado. | ENG-01 |
| E8-13 | P1 | Como time, devo **ter verificação estática do frontend que de fato verifique algo**. | CA: *lint* configurado e rodando no CI. Observação necessária: o `npm run typecheck` atual **não verifica o código** — o `tsconfig.json` tem `checkJs: false` e o projeto é 100% `.js`, de modo que o gate hoje é decorativo. | ENG-02, ENG-04 |
| E8-14 | P1 | Como time, devo **eliminar as divergências entre o contrato documentado e o código**, abertas desde 20/08/2026. | CA: decidir e aplicar em ambos os lados — (1) campo de senha no login: `password` (código) × `senha` (`Especificacao-API`); (2) coleção do usuário: `users` (código) × `usuarios` (`Especificacao-API`). Qualquer que seja a decisão, código e documento passam a dizer a mesma coisa. | CONT-01, CONT-02 |
| E8-15 | P1 | Como titular de dados, devo **ter meus dados descartados no prazo de retenção declarado** (LGPD art. 16). | CA: política de retenção definida e implementada em rotina automática; teste de restauração de *backup* executado e registrado. | OPS-06, OPS-07 |

> **Dependência dura:** **E8-06 (métricas) antes de E8-02**, e **E8-02 antes de qualquer otimização no cliente**. Sem medição, otimizar o app é chute — e a medição já disponível indica que o gargalo dominante é a instância do backend, não o código do aplicativo.

---

## 4. Sequência de entrega sugerida (sprints)

> Atualizado em 02/09/2026 com o que **de fato ocorreu** em S0–S8 e com o replanejamento de S9 em diante. O plano detalhado (pontos, riscos, cerimônias) está em `06-sprints/Plano-Sprints-v2.1.md`.

### 4.1 Executado (S0–S8)

| Sprint | Foco | Estórias | Situação |
|---|---|---|---|
| **S0 (pré)** | Segurança e fundações | F0-01, F0-02, F0-03, F0-05 | ✅ Concluída |
| **S1** | Hospitais + geofence admin + moderação de sugestões | E1-01..E1-06 | ✅ Concluída |
| **S2** | Detecção de visitas (mobile + backend) | E2-01, E2-02, E2-06, E2-07, E2-09 | ✅ Concluída |
| **S3** | Robustez de visitas + feedback backend | E2-03, E2-04, E2-05, E2-10, E3-04, E3-05 | ✅ Concluída |
| **S4** | Feedback mobile + notificações | E3-01, E3-02, E3-03, E3-06 | ✅ Concluída |
| **S5** | Indicadores públicos + conta/privacidade | E4-01..E4-04, E5-01, E5-02, E5-04 | ✅ Concluída |
| **S6** | Polimento e navegação | E6-01..E6-04, F0-04 | ✅ Concluída |
| **S8** | Fechamento do escopo mobile | E4-05 (UI), F-07 (mapa), E5-03 (histórico + PDF), E5-05 (revogação nativa), E6-05 (opt-in) | ✅ Concluída em 01/09/2026 (PRs #48–#52, `develop@f26666e`) |

> **S7 não foi executada.** Estava reservada ao Painel Administrativo Web e foi **adiada** pela decisão D-01. A numeração é mantida para não invalidar as referências dos documentos anteriores — não houve uma "sprint 7" no calendário.

**Resultado:** **42 das 43 estórias do escopo mobile** estão entregues (98%). A única pendência funcional do app é **E4-06 (tendência simples)**, classificada P2. Contando o Épico 7, são 42 de 52 (81%).

### 4.2 Planejado (S9 em diante)

| Sprint | Foco | Estórias | Condição de saída |
|---|---|---|---|
| **S9** | **Desempenho e estabilização** — tornar o sistema utilizável | E8-01, E8-02, E8-03, E8-04, E8-05, E8-12 | Primeira abertura < 5 s sem 5xx; p95 dos endpoints públicos dentro do RNF-02; inventário de bugs fechado e bugs P0 corrigidos |
| **S10** | **Qualidade e observabilidade** — poder confiar no que se mede | E8-06, E8-07, E8-08, E8-09, E8-10, E8-13, E8-14 | Cobertura medida, contrato publicado, *crashes* e latência visíveis, divergências de contrato encerradas |
| **S11** | **Validação pré-lançamento** — o gate que nunca foi executado | V-03, V-04 → V-01, V-02, V-05 → V-06, V-07, V-08 (`Features-MVP-v2.1.md` §11) + E8-15 | V-01..V-08 aprovadas; teste de campo em ≥ 3 hospitais reais concluído |
| **S12** | **Beta fechado** | V-09 + correções decorrentes + E8-11 | 30 dias de beta com ≥ 50 usuários; taxa de resposta ≥ 25%; retenção D7 ≥ 30% |
| **S13+** | **Painel Administrativo Web** ⏸️ | E7-01..E7-09 | Só inicia com S9–S12 concluídas (decisão D-01) |
| *Sem data* | E4-06 (tendência simples) | E4-06 | P2 — entra quando houver folga; não bloqueia lançamento |

> **O que mudou em relação à v2.0:** o plano anterior encerrava em "S6 — Polimento + lançamento", como se o lançamento fosse consequência automática do fim do desenvolvimento. Não é: entre o código pronto e o lançamento existem quatro sprints de estabilização, qualidade e validação que o plano original não previa.

---

## 5. Definição de Pronto (DoD) — MVP

> A v2.0 listava estes sete critérios como se estivessem atendidos (todos com ✅). Nenhum havia sido verificado. A v2.1 registra a situação real de cada um em 02/09/2026 e aponta a estória do Épico 8 que o fecha.

| # | Critério | Situação real | Fecha em |
|---|---|---|---|
| 1 | Código revisado e mergeado na branch principal | ✅ **Atendido** — todo código entra por PR revisado; `develop` = dev, `master` = produção, `release/<tag>` = produção com versão fixada (corrigido na P-004, 03/09/2026 — a branch `main` nunca existiu neste repositório) | — |
| 2 | Testes unitários dos serviços críticos (visita, agregação, auth) com cobertura ≥ 70% nas regras de negócio | ⚠️ **Não verificável** — existem 118 testes no backend e 166 no frontend, mas **a cobertura nunca foi medida**; não há ferramenta configurada | E8-08 |
| 3 | Contratos de API documentados (OpenAPI) e testados via testes de integração | 🔴 **Não atendido** — sem OpenAPI e sem testes de integração com contexto Spring completo | E8-09, E8-10 |
| 4 | Verificação de acessibilidade (WCAG AA) nas telas novas | 🟡 **Parcial** — implementada, nunca auditada | V-07 |
| 5 | Consentimento LGPD implementado e testado (permissões + exclusão de conta) | ✅ **Atendido** — consentimento no cadastro, revogação auditada (art. 8º §5º), exportação (art. 18) e exclusão com anonimização. **Ressalva:** retenção (art. 16) ainda não implementada | E8-15 (ressalva) |
| 6 | Teste de campo de geofence realizado em ≥ 3 hospitais reais | ⛔ **Bloqueado** — decisão D-02; depende do Épico 8 | S11 (V-01) |
| 7 | Métricas de produto instrumentadas (taxa de resposta, tempo de resposta, abandono) | 🔴 **Não atendido** — sem analytics; os KPIs do §2 não são aferíveis hoje | E8-11 |

**Placar: 2 de 7 critérios atendidos.** É essa a distância real entre "código entregue" e "MVP pronto" — e é o que justifica as sprints S9–S12 do §4.2.

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
7. **E1/E1-06 (backend de hospitais e sugestões) antes do Épico 7** — o painel administrativo web é somente consumidor da mesma API; não introduz endpoints novos além dos já previstos em E1.
8. **Épico 8 antes de qualquer teste de campo** — V-01, V-02, V-06 e V-09 medem comportamento em uso real; sobre um sistema que responde em segundos e cai em 503 na primeira abertura, elas medem a infraestrutura, não o produto (decisão D-02).
9. **E8-06 (métricas) antes de E8-02 (orçamento de latência)** — sem medição por endpoint não há como provar que o orçamento foi cumprido, nem onde ele é violado.
10. **E8-12 (testes do frontend no CI) antes de refatorar o frontend** — hoje a esteira roda `typecheck` e `expo export`, mas **não roda `npm test`**; refatorar sem esse gate é trabalhar sem rede de proteção.
11. **Épico 8 + V-01..V-09 antes do Épico 7** — decisão D-01.

---

## 8. Regra de atualização deste backlog

> Acrescentada na v2.1 em resposta à decisão **D-03** (*"Os documentos não foram atualizados no decorrer do desenvolvimento"*). A defasagem custou caro: em 02/09/2026 este backlog e o `Features-MVP` descreviam como "inexistentes" features entregues havia semanas, e o `Features-MVP` ainda registrava como aberta uma violação de segurança corrigida na Fase 0.

1. **O PR que entrega uma estória atualiza o status dela** em `De-Para-Backlog-Features.md`, no mesmo PR. Sem isso, o PR não fecha a estória.
2. **Ao fim de cada sprint**, atualizar §4 (sequência) deste documento e o `Plano-Sprints`, com o que foi entregue e o que escorregou.
3. **Toda decisão de priorização do PO** entra no §2.1 com o registro literal, não parafraseado — o texto original é a fonte, a interpretação é derivada.
4. **Nenhum status ✅ pode ser declarado a partir de intenção**: só a partir de código em `develop` referenciado por PR ou por medição registrada.
5. Alteração relevante gera **nova versão** (v2.1 → v2.2) e a anterior vai para `_historico/`, conforme a regra do `00-INDICE.md`.

---

*Fim do Backlog do MVP v2.1 — revisado em 02/09/2026 após a entrega da Sprint S8 e as decisões D-01, D-02 e D-03.*
