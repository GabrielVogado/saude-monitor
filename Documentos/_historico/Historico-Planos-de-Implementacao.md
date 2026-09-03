# Histórico — Planos de Implementação (`.spec/`)

> **Origem e por que este documento existe.** Entre 26/08 e 01/09/2026, o planejamento
> de quatro frentes de trabalho foi produzido em `.spec/`, um diretório de artefatos de
> ferramenta de agente de IA. Por decisão do PO em 03/09/2026, `.spec/` **não é
> versionado** — é insumo de agente, não documentação do sistema. O conteúdo com valor
> documental foi consolidado aqui antes da remoção, para que o *porquê* das decisões não
> se perdesse junto com o diretório.
>
> Os arquivos originais permanecem na máquina do PO. Este documento é a versão de
> registro. Ver [`Historico-Melhorias.md`](../09-melhoria-continua/Historico-Melhorias.md)
> para o ciclo de melhoria que motivou a limpeza.

## Índice

| Plano | Data | Frente | Estado |
|---|---|---|---|
| [Épico 2 — Detecção de visitas por geofence](#épico-2--detecção-de-visitas-geofence) | 26/08/2026 | Backend + Mobile | 33 de 35 passos concluídos |
| [Revisão de UX, navegação e modo anônimo](#revisão-de-ux-navegação-e-modo-anônimo) | 31/08/2026 | Mobile + Backend | Concluído |
| [Revisão de navegação — Home, Mapa e check-in manual](#revisão-de-navegação--home-mapa-e-check-in-manual) | 31/08/2026 | Mobile | Concluído |
| [Sprint S8 — pendências e stretch do MVP](#sprint-s8--pendências-e-stretch-do-mvp) | 01/09/2026 | Backend + Mobile | Concluído |

---

## Épico 2 — Detecção de visitas (geofence)

**Fonte:** `Backlog-MVP-v2.0.md` (Épico 2, RN-01..RN-07/RN-23/RN-24), `Features-MVP-v2.0.md`
(F-03, F-04), `Plano-Sprints-v2.0.md` (S2/S3), `Especificacao-API-v2.0.md` (§2.3, §3.3).
Estado do código na abertura do plano: 🔴 inexistente — nenhum módulo `visita` no backend,
nenhum geofencing no frontend.

**Ordem adotada:** dependências internas → externas (tipos/modelos → documents/DB → services →
controllers/REST → UI mobile), respeitando a ordem de sprint (S2 antes de S3) e a dependência
explícita **E2-09 (heartbeat) antes de E2-03 (expiração)**.

### Decisões de implementação que divergiram do plano original

| Passo | Decisão | Razão registrada |
|---|---|---|
| Step 14 (E2-09) | Heartbeat e marcação `SUSPEITA` unificados em `VisitaExpiracaoJob`, sem a classe `VisitaSuspeitaJob` prevista | Funcionalmente equivalente, uma classe a menos |
| Step 16 (E2-04) | Empate de geofence ≤10m lança `ConflitoGeofenceException` → HTTP `409` com a lista de `candidatos` | Deixa a escolha para o usuário em vez de desempatar errado |
| Step 24 (E2-01/02) | Tolerâncias RN-01 (2 min) e RN-03 (5 min) aplicadas em memória via `setTimeout` por hospital | Os eventos nativos de geofence disparam uma única vez; a tolerância não existe na API nativa |
| Step 26 (E2-09) | Heartbeat de 30 min só em foreground | Heartbeat nativo em background ficou fora de escopo; a ausência de sinal é coberta pelo job do backend |
| Step 31 (E2-10) | Prompt de tipo de permanência via `Alert.alert` ao focar a Home, não por notificação local | Consistência com o padrão de confirmação já usado no app; `expo-notifications` seria mais complexo e não reaproveitado |
| Step 33 | `watchPositionAsync` (ADR-002) mantido como ferramenta de depuração/mapa | O ciclo de vida das visitas passou para o `GeofencingTaskService` |

### ⚠️ O que ficou aberto

- **Step 34** — testes de unidade/integração dos jobs de expiração e suspeita. *Pode ter sido
  coberto pelo portão de cobertura entregue no PR #60; **precisa de verificação**.*
- **Step 35** — teste manual de campo com geofence real. Nunca executado. É a mesma lacuna
  registrada no `De-Para` como "entregue ≠ utilizável".
- **Step 28** — notificação persistente durante a visita ativa, marcada como pendente no
  próprio plano.

---

## Revisão de UX, navegação e modo anônimo

**Origem:** análise conduzida com o PO a partir de screenshots. Sete defeitos, todos no app
Expo, com apoio pontual no backend.

| # | Defeito | Causa-raiz registrada |
|---|---|---|
| 1 e 2 | "Entrar" e "Criar conta" no Perfil não faziam nada | O helper `irPara` navegava no navigator **pai** (Tab), que não tem as rotas `Login`/`Cadastro`/`Privacidade` — elas vivem no `PerfilStack`. O `navigate` subia e era engolido |
| 3 | Check-in anônimo falhava | O backend exige `dispositivoId`, e o app nunca enviava. `GET /visitas/ativas` exigia autenticação, então o modo anônimo não recuperava a visita |
| 4 | Check-in manual acendia **todos** os botões "Estou aqui" | Estado `enviando` único, compartilhado por todos os cartões |
| 5 | Mapa não mostrava hospitais | `GeoLocalizacaoScreen` renderizava só o marker do usuário |
| 6 | Botões "Entrar"/"Criar conta" empilhados em largura total | Sem hierarquia visual |
| 7 | Voltar à aba Hospitais reabria o detalhe memorizado | Stack aninhado mantinha o detalhe no topo |

**Princípio adotado:** o usuário nunca "identifica o dispositivo" manualmente — o app gera e
persiste um UUID anônimo (`DispositivoId`, em AsyncStorage) e o anexa sozinho.

---

## Revisão de navegação — Home, Mapa e check-in manual

**Proposta do PO:** a Home vira tela de apresentação; geolocalização e check-in manual sobem
para a navegação primária.

- Mapa deixa de ser um botão dentro da Home e vira a **4ª aba** (Início, Hospitais, Mapa, Perfil).
- Home perde o card de visita ativa, os estados de carregamento/erro e os acessos rápidos.
- Cada `CSHospitalCard` ganha um botão compacto de check-in, separado do corpo do card.
- O `HospitalDetalhe` ganha temporizador `hh:mm:ss` e botão "Não estou aqui".

**Regra invariante que guiou o corte:** não quebrar o que já funcionava. Por isso a Home
**manteve** a inicialização do geofencing e a reidratação silenciosa da visita ativa — sem
nenhuma UI. O bloco de temporizador/checkout só aparece quando há visita ativa de origem
`MANUAL` **do hospital em questão**; nunca para visitas `GEOFENCE` ou de outro hospital,
preservando o detalhe público.

---

## Sprint S8 — pendências e stretch do MVP

**Referência:** `Plano-Sprints-v2.0.md` §21 · 15 story points · 5 estórias.
Ordem de merge definida: E4-05 → F-07 → E5-03 → E5-05 → E6-05.

### Decisões de escopo validadas com o PO em 01/09/2026

| # | Decisão | Razão |
|---|---|---|
| 1 | Uma branch e um PR por ID de estória, com commits separados | Rastreabilidade por estória |
| 2 | E5-05 ganha `PUT /api/v1/contas/consentimentos` | Auditoria da revogação, LGPD art. 8º §5º |
| 3 | E5-03 exporta **PDF**, não CSV, gerado **no backend** | "Mais acessível ao cidadão" |
| 4 | F-07 usa `@maplibre/maplibre-react-native`, não `react-native-maps` | O plano v2.0 estava desatualizado — a migração ocorreu no PR #45 |

**DoD do sprint, registrado como cumprido:** suíte frontend verde, `tsc --noEmit` sem erros,
build backend verde e `Relatorio-Aderencia-Codigo-vs-Features.md` atualizado para a v3.5.
