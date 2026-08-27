# 📋 Documento Negocial — Clinical Sanctuary v2.0

> **Sistema de Monitoramento Hospitalar por Geolocalização com Feedback Pós-Atendimento**
>
> | Campo | Valor |
> |---|---|
> | **Versão** | 2.0 |
> | **Status** | Proposta estruturada — aguardando validação com stakeholders |
> | **Data** | 07/08/2026 |
> | **Autor** | Gabriel Vogado (Product Owner) |
> | **Base histórica** | v1.0 SAS (agendamento de saúde — descontinuado) · v1.1 arquitetura de monitoramento hospitalar |

---

## 1. Sumário Executivo

O **Clinical Sanctuary** é um aplicativo mobile que monitora automaticamente o tempo que uma pessoa permanece dentro de uma área hospitalar (via **geolocalização/geofence**) e, **ao sair**, convida essa pessoa a responder um **formulário de feedback curto e não-cansativo** sobre o atendimento recebido (triagem, presença de médico, atendimento por equipe, medicação/receita e nota geral).

Com esses dados, o app calcula e **exibe publicamente** dois indicadores por hospital:

1. **Tempo médio de atendimento** (baseado no tempo de permanência registrado dos usuários);
2. **Avaliação média** (nota de 1 a 5 calculada a partir dos feedbacks).

O objetivo de negócio é duplo:

- **Para o cidadão:** escolher hospitais com base em dados reais, e dar voz à sua experiência sem esforço;
- **Para as instituições:** receber um indicador público contínuo de percepção de qualidade e tempo de espera, servindo como termômetro para melhoria.

O MVP prioriza **zero fricção**: detecção automática, formulário com no máximo 4 perguntas, resposta em menos de 45 segundos e navegação pública sem obrigatoriedade de login.

---

## 2. Contexto e Problema

### 2.1 Cenário atual

Pacientes e acompanhantes que utilizam hospitais (públicos e privados) enfrentam:

- **Falta de informação:** não sabem, em média, quanto tempo um hospital leva para atender;
- **Impossibilidade de comparação:** não há um indicador público e imparcial de qualidade percebida por hospital;
- **Silêncio do paciente:** quem passou por mau atendimento não tem canal rápido e de baixo esforço para registrar a experiência;
- **Decisão no escuro:** a escolha de onde buscar atendimento é baseada em boca a boca ou urgência, sem dados.

### 2.2 Problema central (statement)

> **"O cidadão não tem como saber, antes de entrar, quanto tempo vai esperar e como é a qualidade real do atendimento de um hospital — e, depois de sair, não tem um canal rápido e não-burocrático para registrar sua experiência."**

### 2.3 Oportunidade

- Todo celular moderno tem GPS, o que permite **medição objetiva** do tempo de permanência sem nenhuma ação do usuário;
- Um formulário de **4 perguntas em 45 segundos** resolve a barreira clássica de resposta a pesquisas de satisfação (NPS hospitalar tradicional tem taxas de resposta baixíssimas);
- O agregado público cria um **círculo virtuoso**: mais dados → mais utilidade → mais usuários → mais dados.

---

## 3. Proposta de Valor

| Para quem | Valor entregue |
|---|---|
| **Paciente / acompanhante** | Entra sem apertar nada; sai e responde em 30-45s; consulta tempo médio e nota de qualquer hospital; decide com dados. |
| **Cidadão em geral** | Ranking público e transparente de hospitais por tempo de atendimento e avaliação. |
| **Gestão hospitalar** | Indicador contínuo de percepção do paciente (tempo e nota) para priorizar melhorias; painel institucional futuro (evolução). |
| **Sociedade / poder público** | Base de evidência sobre experiência do usuário no sistema de saúde (dados agregados e anônimos). |

### Diferenciais competitivos

1. **Medição objetiva do tempo** (GPS/geofence) — não depende de auto-declaração do usuário;
2. **Feedback com esforço mínimo** — 4 perguntas, puláveis, com comentário opcional;
3. **Transparência metodológica** — nota exibida somente com amostra mínima (N ≥ 5) e data da medição.

---

## 4. Público-Alvo e Personas

### 4.1 Segmentos

| Segmento | Papel no produto | Prioridade MVP |
|---|---|---|
| **Pacientes e acompanhantes** (público geral) | Produtores de dados (feedback) e consumidores (consulta pública) | 🔴 Alta |
| **Gestores de hospitais** | Consumidores (painel institucional futuro) | 🟡 Média (pós-MVP) |
| **Instituições de saúde / poder público** | Consumidores de relatórios agregados | 🟢 Baixa (fase 3) |

### 4.2 Personas (resumo — detalhe no documento UI/UX)

- **Marina (34, paciente):** usuária principal. Quer zero fricção na entrada e feedback rápido na saída. Não quer login obrigatório.
- **Carlos (28, acompanhante):** responde pelo pai idoso no mesmo celular. Precisa de linguagem simples e perguntas puláveis.
- **Dra. Renata (41, gestora):** consome os agregados para melhorar a instituição. Painel institucional é evolução futura.

---

## 5. Escopo

### 5.1 Dentro do escopo (MVP)

- Cadastro e autenticação opcional de usuários (conta para histórico e perfil);
- Cadastro de hospitais com **área geográfica (geofence)** — polígono aproximado da unidade;
- Detecção automática de **entrada e saída** da área hospitalar (GPS + geofencing);
- Cálculo do **tempo de permanência** por visita;
- **Formulário de feedback pós-saída** (até 4 perguntas, pulável, comentário opcional);
- **Agregação pública** por hospital: tempo médio de permanência e nota média (com N mínimo);
- Tela pública de detalhe do hospital (nota, tempo médio, número de avaliações, histórico simples);
- Consentimento LGPD granular (localização, dados, termos);
- Tratamento anti-fraude básico (evitar múltiplas avaliações repetidas da mesma visita/dispositivo).

### 5.2 Fora do escopo (MVP) — escopo negativo

- ❌ Agendamento de consultas (visão v1.0 SAS, descontinuada);
- ❌ Prontuários médicos, exames e resultados;
- ❌ Pagamentos e teleconsulta;
- ❌ Painel institucional completo para hospitais (fase 2);
- ❌ Integração com sistemas internos de hospitais (API hospitalar) — fase 2;
- ❌ Atendimento emergencial em tempo real (ambulâncias etc.);
- ❌ IA para triagem ou diagnóstico.

---

## 6. Regras de Negócio

### 6.1 Ciclo de visita (geofence)

| # | Regra | Detalhamento |
|---|---|---|
| RN-01 | **Detecção de entrada** | Quando o app detecta que o usuário está dentro de um geofence hospitalar por **tempo de permanência mínimo de 2 minutos contínuos**, inicia-se uma visita. Tempo inferior a 2 min é ignorado (evita "atravessou a rua"). |
| RN-02 | **Visita ativa** | Enquanto dentro da área, o app mantém a visita em status `EM_ATENDIMENTO` e acumula o tempo de permanência. Nenhuma ação do usuário é necessária. |
| RN-03 | **Detecção de saída** | Quando o usuário sai da área por **mais de 5 minutos consecutivos**, a visita é encerrada (`FINALIZADA`) e o tempo total é gravado. Saídas curtas (ex.: fumar na calçada) não encerram a visita. |
| RN-04 | **Máximo de sessão** | Uma visita em andamento **não expira por tempo de permanência** enquanto o app enviar heartbeats periódicos. Para proteção contra GPS "preso" (falso positivo), a visita expira automaticamente apenas após **24 horas sem nenhum heartbeat** do dispositivo. Esperas reais de 12h+ (comuns na saúde pública brasileira) permanecem ativas enquanto houver sinal (ver RN-23). |
| RN-05 | **Conflito de hospitais** | Se o usuário estiver dentro da área de 2 hospitais ao mesmo tempo (áreas sobrepostas), vale o hospital com menor distância ao ponto atual; se ambiguidade persistir, o app pergunta em 1 toque. |
| RN-06 | **Falha de GPS** | Se o GPS ficar indisponível durante uma visita, o app mantém a visita e tenta recuperar a posição por até 10 min; após isso, encerra com o tempo parcial e sinaliza `GPS_INTERROMPIDO` no registro. |
| RN-07 | **Mínimo para estatística** | Visitas com tempo inferior a **2 minutos** não entram nas estatísticas públicas (ruído). |

### 6.2 Feedback pós-saída

| # | Regra | Detalhamento |
|---|---|---|
| RN-08 | **Disparo** | Após encerrar a visita, o app aguarda **1 a 5 minutos** e envia uma notificação local convidando ao feedback. Nenhuma notificação é enviada dentro da área hospitalar (evita resposta sob pressão). |
| RN-09 | **Janela de validade** | O feedback pode ser respondido em até **24 horas** após a saída. Após esse período, a visita recebe status `SEM_FEEDBACK` e não incomoda mais o usuário (máximo de **1 lembrete**). |
| RN-10 | **Estrutura do formulário (máx. 4 telas / < 45s)** | **Fluxo ramificado de 4 telas (máx.) — ramificação invisível ao usuário:**<br/><br/>**Tela 1 — Triagem**<br/>• "Você passou pela triagem ao chegar na unidade?"<br/>• ✅ Sim → **Tela 2**<br/>• ❌ Não → **Tela 3** (pula especialidade)<br/><br/>**Tela 2 — Especialidade procurada + Atendimento** (só se triagem = Sim)<br/>• "Qual especialidade você procurava?" → select searchable (lista CNES/DATASUS)<br/>• "Conseguiu ser atendido por médico(a) desta especialidade?"<br/>  - ✅ Sim → **Tela 3**<br/>  - ❌ Não → **motivo** (radio obrigatório):<br/>    🔴 **LOTACAO** — Superlotação / espera excessiva<br/>    👨‍⚕️ **FALTA_MEDICO** — Falta de médico na especialidade<br/>    ⚪ **CLASSIFICACAO_RISCO** — Prioridade a casos mais graves (Protocolo Manchester: Vermelho/Laranja)<br/>    🚪 **OUTRO** — campo curto opcional<br/>• → **Tela 3**<br/><br/>**Tela 3 — Tratamento pela equipe** (sempre exibida)<br/>• "Como foi o tratamento dos funcionários da unidade com você?"<br/>• Escala 5 pontos + "Não interagi": Muito bem / Bem / Regular / Mal / Muito mal / Não interagi<br/>• → **Tela 4**<br/><br/>**Tela 4 — Nota geral + Comentário** (sempre exibida)<br/>• "De 1 a 5, como avalia sua experiência geral hoje?" → ★★★★★<br/>• "Quer deixar algum comentário?" (opcional, max 500 chars)<br/>• Botão "Enviar"<br/><br/>**Regras transversais:**<br/>• `especialidadeProcurada` **sempre capturada** se triagem = Sim (mesmo se não atendido) → permite indicador de "falta de médico por especialidade"<br/>• `motivoNaoAtendido = CLASSIFICACAO_RISCO` **não é gap** — card "Fluxo Correto" no painel admin (verde)<br/>• `motivoNaoAtendido = FALTA_MEDICO` → gap RH (vermelho no painel)<br/>• `motivoNaoAtendido = LOTACAO` → gap Capacidade/Fluxo (laranja no painel)<br/>• Frontend mostra label amigável `CASOS_MAIS_GRAVES_PRIORIDADE`; backend normaliza para `CLASSIFICACAO_RISCO`<br/>• Comentário opcional único no final; zero caixas de texto obrigatórias<br/>• Persistência local a cada tela; envio único no final (`POST /api/v1/feedback` com `visitaId`) |
| RN-11 | **Pular** | Todas as perguntas são **puláveis** (botão "Pular" visível em todas as telas). O envio é possível com pelo menos a nota geral respondida (Tela 4). Progresso visível (ex.: 1/4, 2/4...). A Tela 2 (especialidade + atendimento) **só existe** se triagem = Sim — caso contrário, o usuário não vê essa tela (não conta como "pulou"). |
| RN-12 | **Dedupe** | Só é possível **1 feedback por visita**. Feedback duplicado do mesmo dispositivo/visita é rejeitado. |
| RN-13 | **Anonimização** | O feedback é armazenado **sem vínculo obrigatório** à identidade; quando o usuário está logado, o vínculo é interno e nunca exposto publicamente. |

### 6.3 Agregação e exibição pública

| # | Regra | Detalhamento |
|---|---|---|
| RN-14 | **Nota média** | Média aritmética das notas 1–5 dos feedbacks válidos do hospital, no período configurável (padrão: **últimos 90 dias**). |
| RN-15 | **Amostra mínima (N)** | A nota pública só é exibida com **N ≥ 5 avaliações** no período. Abaixo disso, exibe-se "Ainda sem avaliações suficientes". |
| RN-16 | **Tempo médio de atendimento** | Mediana dos tempos de permanência das visitas finalizadas do hospital no período, **considerando apenas visitas de até 24 horas** e **excluindo as marcadas como `INTERNACAO`/`OBSERVACAO`** (RN-24). A mediana é robusta a outliers; o teto de 24h separa atendimento de longa permanência não-sinalizada. |
| RN-17 | **Composição do indicador** | Tempo médio considera apenas visitas de **até 24 horas** (não 8h, pois filas de 12h+ são comuns na saúde pública brasileira) e exclui visitas marcadas como `INTERNACAO`/`OBSERVACAO` (RN-24). Visitas `GPS_INTERROMPIDO` entram apenas se o tempo parcial for confiável (≥ 90% do período coberto). |
| RN-18 | **Atualização** | Indicadores recalculados por agregação (batch/evento) — atualização pública em até **15 minutos** após novo feedback. |
| RN-19 | **Transparência** | A tela pública mostra: nota, tempo médio, N de avaliações, período e data da última atualização. |

### 6.4 Conta e permissões

| # | Regra | Detalhamento |
|---|---|---|
| RN-20 | **Uso sem login** | Consultar hospitais, ver nota pública e até **responder feedback anônimo** não exige login. Login é opcional (histórico, perfil, preferências). |
| RN-21 | **Consentimento** | O app solicita permissão de localização **em etapas e com explicação clara** do uso (LGPD). O usuário pode revogar a qualquer momento. |
| RN-22 | **Histórico** | Usuário logado vê o próprio histórico de visitas e feedbacks (somente dele). |
| RN-23 | **Heartbeat de presença** | Enquanto a visita está ativa, o app envia um **heartbeat a cada 30 minutos** (ver API). Ausência de heartbeat por **2 horas** marca a visita como `SUSPEITA`; ausência por **24 horas** aciona a expiração (RN-04). O heartbeat é o sinal que distingue **espera real** (pessoa de fato no hospital, ex.: fila de 12h+ no SUS) de **GPS preso/falso positivo** (dispositivo parado na região sem o usuário estar no hospital). |
| RN-24 | **Sinalização de internação/observação** | Após **12 horas** de visita ativa, o app pergunta em **1 toque**: *"Você está em observação ou internado?"*. Se o usuário confirmar, a visita recebe `tipoPermanencia = OBSERVACAO | INTERNACAO` e é **excluída do indicador de tempo de pronto-atendimento** (permanece no histórico pessoal). Se o usuário não responder ou negar, a visita continua ativa e contabilizada normalmente. Isso evita que internações/observações longas distorçam o "tempo médio de atendimento" sem perder a medição de quem realmente espera na fila. |

---

## 7. Requisitos Funcionais e Não-Funcionais

### 7.1 Requisitos funcionais (RF)

| ID | Requisito |
|---|---|
| RF-01 | O app deve detectar entrada/saída de áreas hospitalares cadastradas via geofence. |
| RF-02 | O app deve cronometrar o tempo de permanência por visita. |
| RF-03 | O app deve exibir a tela pública de um hospital com nota média, tempo médio e N. |
| RF-04 | O app deve permitir responder o feedback pós-saída em até 4 perguntas + comentário opcional. |
| RF-05 | O app deve permitir consultar hospitais próximos no mapa e buscar por nome. |
| RF-06 | O app deve permitir cadastro/login opcional e exibir histórico pessoal de visitas. |
| RF-07 | O app deve solicitar consentimento de localização em etapas e permitir revogação. |
| RF-08 | (Backoffice) O sistema deve permitir cadastrar/editar hospitais e suas áreas geográficas. |

### 7.2 Requisitos não-funcionais (RNF)

| ID | Requisito | Meta |
|---|---|---|
| RNF-01 | **Usabilidade** | Feedback respondido em **< 45s**; tela compreendida em **≤ 2s**; alvos de toque **≥ 48dp**. |
| RNF-02 | **Desempenho** | Abertura da tela pública do hospital **< 2s** (p95) em rede 4G; API p95 **< 300ms**. |
| RNF-03 | **Bateria** | Monitoramento de geofence com consumo de bateria compatível com uso diário (< 5% por dia de monitoramento em background). |
| RNF-04 | **Disponibilidade** | 99,5% em produção (janela de manutenção programada). |
| RNF-05 | **Segurança** | Senhas com hash forte (bcrypt/argon2); transporte HTTPS; JWT com expiração; rate limiting em endpoints públicos. |
| RNF-06 | **Privacidade (LGPD)** | Minimização de dados, consentimento granular, direito de exclusão, anonimização dos agregados. |
| RNF-07 | **Compatibilidade** | Android 8+ e iOS 15+ (Expo 55 / RN 0.83). |
| RNF-08 | **Acessibilidade** | WCAG 2.2 AA. |

---

## 8. Modelo de Dados Conceitual

```mermaid
erDiagram
    USUARIO ||--o{ VISITA : "realiza"
    USUARIO ||--o{ FEEDBACK : "envia (opcional)"
    HOSPITAL ||--o{ VISITA : "recebe"
    HOSPITAL ||--o{ FEEDBACK : "recebe"
    HOSPITAL {
        string id PK
        string nome
        string endereco
        object geofence "GeoJSON Polygon"
        boolean ativo
    }
    USUARIO {
        string id PK
        string nome
        string email
        string senha_hash
        boolean opt_localizacao
    }
    VISITA {
        string id PK
        string usuario_id FK "pode ser anonimo"
        string hospital_id FK
        datetime entrada
        datetime saida
        int duracao_minutos
        string status "EM_ATENDIMENTO|SUSPEITA|FINALIZADA|EXPIRADA|GPS_INTERROMPIDO"
        string tipo_permanencia "ATENDIMENTO|OBSERVACAO|INTERNACAO"
        datetime ultimo_heartbeat "para RN-04/RN-23"
    }
    FEEDBACK {
        string id PK
        string visita_id FK "UNIQUE"
        string hospital_id FK
        boolean foi_atendido
        string motivo_nao_atendido "opcional"
        string teve_medico "SIM|NAO|NAO_PRECISEI"
        string fez_triagem "SIM|NAO|NAO_SEI"
        string medicacao_receita "SIM|NAO|NAO_PRECISEI"
        int nota 1..5
        string comentario "opcional"
        datetime criado_em
    }
    AGREGADO_HOSPITAL {
        string hospital_id PK
        float nota_media
        int n_avaliacoes
        int tempo_mediano_minutos
        datetime periodo_inicio
        datetime periodo_fim
        datetime atualizado_em
    }
```

> Notas de modelagem: `VISITA` pode ser anônima (sem `usuario_id`) para feedback sem login. `FEEDBACK.visita_id` é único (1 feedback por visita). `AGREGADO_HOSPITAL` é um documento materializado para leitura pública rápida (cache de agregação). `tipo_permanencia` permite separar pronto-atendimento de internação/observação (RN-24); `ultimo_heartbeat` viabiliza a expiração por ausência de sinal (RN-04/RN-23).

---

## 9. KPIs e Métricas de Sucesso

### 9.1 Métricas de produto

| Métrica | Definição | Meta MVP (90 dias) |
|---|---|---|
| **Taxa de resposta de feedback** | Feedbacks respondidos ÷ visitas finalizadas | ≥ 25% |
| **Tempo médio de resposta** | Tempo entre saída e envio do feedback | < 5 min |
| **Fricção percebida** | Abandono no meio do formulário | < 20% |
| **Usuários ativos semanais** | Usuários com visita detectada na semana | 1.000 |
| **N de hospitais com N ≥ 5** | Hospitais com avaliação pública válida | 20 |
| **Retenção D30** | Usuários que voltam ao app após 30 dias | ≥ 15% |

### 9.2 Métricas de negócio

- **Número de visitas registradas** (volume de dados);
- **Número de avaliações públicas exibidas** (utilidade do agregado);
- **Custo por feedback coletado** (eficiência do funil).

---

## 10. Critérios de Aceite (resumo operacional)

1. ✅ Usuário entra em área hospitalar cadastrada → app detecta em **≤ 2 min** e inicia cronômetro sem ação manual;
2. ✅ Usuário sai da área → app encerra visita e dispara notificação de feedback em **1–5 min**;
3. ✅ Feedback respondido em **< 45s** com 4 perguntas, puláveis, + comentário opcional;
4. ✅ Tela pública do hospital mostra **nota, tempo médio, N, período e data**, respeitando N ≥ 5;
5. ✅ Sem login obrigatório para consultar e avaliar (feedback anônimo possível);
6. ✅ Consentimento de localização explicado em etapas e revogável;
7. ✅ Duplicidade de feedback por visita bloqueada;
8. ✅ Indicadores públicos atualizados em **≤ 15 min** após novo feedback.

---

## 11. LGPD e Privacidade

| Pilar | Implementação |
|---|---|
| **Base legal** | Consentimento explícito para geolocalização (art. 7º, I) e legítimo interesse para estatísticas agregadas anônimas. |
| **Minimização** | Coleta apenas: posição (para geofence), tempo de permanência, respostas do feedback, e dados opcionais de conta. |
| **Consentimento granular** | Permissões separadas: localização / conta / notificações. Revogação em 2 toques (Perfil → Dados e Privacidade). |
| **Anonimização** | Agregados públicos são anônimos; feedback não expõe identidade. |
| **Direitos do titular** | Exportação e exclusão de dados pessoais via API e tela de perfil. |
| **Retenção** | Dados pessoais de conta retidos enquanto a conta existir; dados de localização agregados sem vínculo pessoal após 90 dias. |
| **Segurança** | Senha com hash, HTTPS, JWT, controle de acesso por papel. |
| **Comunicação** | Termos de uso e política de privacidade em linguagem simples, disponíveis no onboarding. |

> ⚠️ **Atenção**: o histórico contém menções a "HIPAA Compliant" (padrão americano). Para o mercado brasileiro, o app deve exibir apenas **LGPD**. Correção já prevista no Padrão UI/UX v2.0.

---

## 12. Roadmap de Evolução

| Fase | Entrega | Prazo estimado |
|---|---|---|
| **MVP (Fase 1)** | Geofence + visitas + feedback curto + tela pública de avaliação + LGPD | 8–12 semanas |
| **Fase 2** | Painel institucional para hospitais (mesmos dados + alertas), busca avançada, histórico detalhado | + 8 semanas |
| **Fase 3** | Integração com sistemas hospitalares, relatórios para poder público, expansão de cidades | + 12 semanas |

---

## 13. Riscos e Mitigações

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | **Baixa taxa de resposta** ao feedback | Média | Alto | Formulário ≤ 4 perguntas, notificação no momento certo, 1 lembrete, feedback anônimo sem login |
| R2 | **GPS impreciso / bateria** | Média | Médio | Geofence nativo (menor consumo), tolerâncias de 2min/5min, fallback manual em 1 toque |
| R3 | **Avaliações fraudulentas** (inflar/rebaixar nota) | Média | Alto | 1 feedback por visita, N mínimo, detecção de padrões, revisão de outliers |
| R4 | **Representatividade** (poucos hospitais com N ≥ 5) | Alta | Médio | Comunicação clara de "sem amostra", foco em captação em áreas com alta densidade de hospitais |
| R5 | **LGPD / privacidade** | Média | Alto | Consentimento granular, anonimização, DPO consultado antes do lançamento |
| R6 | **Dependência de permissão de localização em background** (iOS) | Alta | Médio | Estratégia de geofence com `startGeofencingAsync` (permitido em background no iOS com justificativa), fallback foreground |
| R7 | **Visita "presa" por GPS em esperas longas reais** (12h+ no SUS) | Média | Alto | Heartbeat periódico (RN-23) distingue espera real de falso positivo; expiração apenas após 24h sem heartbeat (RN-04); sinalização de internação/observação em 1 toque (RN-24) preserva a métrica de pronto-atendimento |

---

## 14. Glossário

| Termo | Definição |
|---|---|
| **Geofence** | Área geográfica virtual (polígono) associada a um hospital; entrada/saída são detectadas por GPS. |
| **Visita** | Período contínuo de permanência do usuário dentro de um geofence hospitalar. |
| **Feedback** | Resposta do usuário ao formulário pós-saída sobre o atendimento. |
| **Heartbeat** | Sinal periódico (a cada 30 min) enviado pelo app enquanto a visita está ativa; distingue espera real de GPS "preso" (RN-23). |
| **N (amostra)** | Quantidade mínima de avaliações para exibir indicador público. |
| **Tempo médio de atendimento** | Mediana dos tempos de permanência das visitas (até 24h, excluindo internação/observação) do hospital no período. |
| **Nota média** | Média aritmética das notas 1–5 dos feedbacks válidos no período. |

---

*Fim do Documento Negocial v2.0 — revisar com stakeholders antes de congelar escopo do MVP.*
