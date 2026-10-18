# Contexto — Análise de escalabilidade, segurança e custo do Radar Saúde (17–18/10/2026)

> Este arquivo resume uma sessão de trabalho com o Claude Code e serve de conhecimento do projeto "Radar Saude".
> A fonte da verdade é o relatório no repositório (caminhos no §9 deste arquivo). Se algo divergir, vale o relatório.
> Referências escritas "§N do relatório" apontam para o relatório; "§N" sozinho aponta para este arquivo.

---

## 1. O produto, em uma tela

- **Radar Saúde** (repositório `GabrielVogado/saude-monitor`). O app detecta por geofence quanto tempo a pessoa ficou num hospital e, depois que ela sai, pede uma avaliação curta. Para cada estabelecimento, publica o tempo mediano de atendimento e a nota média. As duas métricas só aparecem com **N ≥ 5** avaliações (RN-15). São ~341 estabelecimentos do DF, vindos do CNES/DATASUS.
- **Stack:**
  - **Backend:** Spring Boot 4.0.4 (WebMVC), Java 25 com threads virtuais, Spring Data MongoDB, Spring Security com JWT (jjwt, HMAC), BCrypt custo 10 e Testcontainers.
  - **App:** Expo 55 / React Native 0.83, TanStack Query e Zustand, `@rnmapbox/maps` v10 e `expo-location` com `startGeofencingAsync` (19 hospitais mais 1 região de recálculo, por causa do limite de 20 regiões do iOS).
  - **Painel admin:** Angular 21, em `admin/`.
- **Infraestrutura atual:**
  - Cloud Run em `southamerica-east1`: 1 vCPU, 1 GiB, `min-instances=0` e `max-instances=1`.
  - MongoDB Atlas **M0** gratuito, compartilhado entre dev e homologação.
  - Resend no plano gratuito (100 e-mails/dia).
  - O site `saudemonitor.dev` roda em Cloudflare Workers.
  - Rate limit: 10 auth/60 público req/min por IP no dev (e na produção, quando existir); 300/2.000 na homologação, por causa dos testes.
- **Ambientes:**
  - `develop` → dev.
  - `master` → homologação, com tag `vX.Y.Z-rc.N`.
  - `release/<versão>` → produção. **A produção ainda não existe:** os segredos `_PROD` e o serviço de produção não foram criados. A branch `release/` nasce pelo `release.yml` (manual), a partir da rc homologada, e dispara o backend de produção e o AAB.
- **Equipe:** Gabriel Vogado acumula PO e responsável técnico, com desenvolvimento assistido e sem plantão.

## 2. O pedido desta sessão

O PO pediu uma análise de Engenharia de Software, Arquitetura de Software e Arquitetura de Soluções. O objetivo era deixar o sistema **escalável e seguro, com o menor custo que entregue valor**, mirando uso por **60–70% da população do DF**. O ponto de partida: o teste de carga passa com 100 usuários, mas não se sabe se o sistema aguentaria "100 mil requisições".

Ele pediu também:
- pelo menos 10 perguntas de alinhamento;
- um **PDF dividido por setores**, com cada gap e as soluções possíveis;
- as perguntas no final do PDF, com sugestões recomendadas.

## 3. O que foi entregue

- **Relatório:** `Documentos/02-arquitetura-tecnica/Analise-Escalabilidade-Seguranca-DF-v1.0.md`, com o PDF ao lado (45 páginas) e o diagrama em `Documentos/02-arquitetura-tecnica/assets/arquitetura-alvo-df-v1.0.svg`. O `Documentos/00-INDICE.md` foi atualizado (item 3d).
- **PR:** [GabrielVogado/saude-monitor#203](https://github.com/GabrielVogado/saude-monitor/pull/203) (`claude/kind-carson-32gxm5` → `develop`). Foi **mergeado em `develop` em 18/10/2026**, com os commits `08fa403`, `c67a4de` e `f1b893f`, CI verde e Quality Gate do SonarQube aprovado.
- **Commit-base da análise:** `develop@1d2e431` (homologação `v1.0.0-rc.5`).
- **Status do relatório:** 🟡 Proposta, aguardando as respostas do PO (§7).
- **Limites:** nenhum código foi alterado e nenhum teste de carga foi executado. Os achados de segurança vieram da leitura do código e **não foram explorados**.

## 4. Conclusões principais

1. **Ninguém mediu quanto o sistema aguenta.** O teste de 23/09 rodou a ~7,4 req/s (1.200 requisições em 162 s). A hipótese de ~80 req/s por instância nunca foi medida.
2. **Quatro tetos rígidos** (§1.1 do relatório):
   - uma instância só, por causa da corrida do `SeedRunner`;
   - Atlas M0 a 100 op/s, que estrangula com ~250 usuários simultâneos;
   - rate limit por IP em memória, que bloqueia gente real atrás do CGNAT das operadoras, inclusive na renovação de token;
   - leitura pública sem cache.

   Outros gaps **Altos**: jobs `@Scheduled` sem garantia de disparo (SOL-05) e e-mail limitado a 100/dia (SOL-08).
3. **Uma fonte de carga que o plano de escala de 08/10 não modelou.** Cada vez que a pessoa sai da região de recálculo, o app chama `GET /api/v1/hospitais?latitude=…&longitude=…&raioKm=5&size=50` (`frontend/src/screens/visitas/service/GeofencingTaskService.js:731-737`). Essa região tem raio entre 100 m e 2,5 km: metade da distância até o 19º hospital mais próximo. A estimativa usa de 1,5 a 2,5 km. Na meta, isso dá **~333 req/s que não podem ser cacheados**.
4. **Patamares de carga** (Plano de Escala §4.2; **não confundir com as perguntas P1–P15**):

   | Patamar | Instalações / situação |
   |---|---|
   | P1 Lançamento | 30 mil instalações |
   | P2 Adoção | 300 mil |
   | P3 Massa | 900 mil |
   | **Meta 60–70%** | **≈2,0 mi** |
   | P4 | 2,4 mi |
   | P5 Evento | 600 mil abrindo na mesma hora, ~6.000 req/s |
   | P6 | 3 mi no mesmo minuto (só a borda aguenta) |

5. **Carga na meta:**

   | | Origem | Banco | Instâncias |
   |---|---|---|---|
   | Desenho atual | ~633 req/s | ~1.690 op/s | ~16 |
   | Arquitetura-alvo (catálogo local + borda) | ~180 req/s | ~460 op/s | ~5 |

   Premissas (Anexo B do relatório):
   - 10% de uso diário (DAU) e 15% das sessões na hora de pico, com fator de rajada 3;
   - 12 requisições e 41 operações no banco por sessão;
   - 40% das pessoas com localização em segundo plano e 10 recálculos por dia;
   - ~80 req/s por instância, dividido por 40 para ter folga.
6. **Custo estimado** (US$/mês, preço de lista, a conferir antes de contratar):

   | Patamar | Total | Composição |
   |---|---|---|
   | Lançamento | ~55–120 | Cloud Run 15–70, Atlas Flex 8–15, Resend 20, outros ~10 |
   | Adoção | ~75–165 | |
   | **Meta** | **~275–710** | Cloud Run 100–250, Atlas M10–M20 105–260, Resend 35–90, tiles no R2 10–40, borda 5–30, Scheduler/Logging/Monitoring 10–30, domínio + Apple ~10 |
   | Evento | +30–85 por dia | |

   - **Sem catálogo local e sem borda**, a meta exige ~3× as instâncias e um Atlas M30: ~US$ 1.000+/mês só nessas duas linhas.
   - **Mapbox:** somaria **+US$ 3–4 mil/mês** na meta (cobra por usuário ativo). A recomendação é MapLibre com PMTiles.
7. **Ficam de fora nesta fase:** Kubernetes, microsserviços, Kafka, Redis e WebFlux. Cada um tem gatilho de reavaliação no §12.3 do relatório.

## 5. Gaps (46: 8 críticos, 13 altos, 20 médios, 5 baixos)

Prioridade = (Impacto + Risco) × (6 − Esforço). A maior é o **DAD-02 (45)**. Em seguida, com 40: SOL-01, SOL-03, ARQ-02, PERF-01, SOL-08, PERF-02, OPS-01 e ENG-01. O SEG-01 e o APP-01 têm prioridade numérica menor só porque exigem muito esforço; precisam estar resolvidos antes do lançamento.

**Críticos → correção (fase):**

| Gap | Problema | Correção | Fase |
|---|---|---|---|
| SOL-01 | Atlas M0 compartilhado, sem produção | Atlas dedicado no GCP São Paulo (Flex → M10 → M20), com backup | F3 |
| SOL-02 | `max-instances=1` | Seed num Cloud Run Job com upsert por `codigoCnes`; depois máximo de 10 instâncias na homologação e 20 na produção | F1 |
| SOL-03 | Sem borda nem domínio próprio para a API | Cloudflare Free em `api.saudemonitor.dev`; o domínio entra já no 1º build de loja | F2 |
| ARQ-01 | Catálogo não cacheável | `GET /api/v1/catalogo` com ETag e cache (F1, no servidor); catálogo no app (F2) | F1–2 |
| ARQ-02 | Rate limit por IP | Borda limita por IP com teto alto; a aplicação limita por `sub`/aparelho; a renovação usa o próprio token, não o IP | F1 |
| APP-01 | Recálculo de geofence em segundo plano | Catálogo local; o recálculo vira conta no aparelho | F2 |
| SEG-01 | Ranking manipulável por script | Atestação do aparelho + prova de presença; o indicador conta só avaliações verificadas | F1–5 |
| PERF-01 | Capacidade nunca medida | Prova de carga do §15 do relatório | F4 |

**Altos:**
- SOL-04: cold start com 503;
- SOL-05: jobs `@Scheduled`;
- SOL-08: e-mail a 100/dia;
- ARQ-05: sem timeouts nem modo evento;
- APP-02: Mapbox;
- SEG-02;
- DAD-01: GPS guardado sem prazo, sendo dado sensível;
- DAD-02: sem backup;
- PERF-02: modelo de carga;
- OPS-01: sem alertas nem SLO;
- OPS-04: produção e runbooks;
- ENG-01: requisitos não funcionais;
- ENG-03: operação concentrada numa pessoa.

**Médios:**
- SOL-06, SOL-07, SOL-09;
- ARQ-03, ARQ-04, ARQ-07;
- APP-03, APP-04 (iOS);
- SEG-03, SEG-04 (JWT), SEG-05 (painel admin), SEG-06 (contêiner), SEG-08 (Atlas);
- DAD-03 (RIPD);
- PERF-03;
- OPS-02, OPS-03, OPS-05;
- ENG-02, ENG-04.

**Baixos:** ARQ-06, ARQ-08, ARQ-09, SEG-07 e PERF-04.

**Segurança, em detalhe:**
- **SEG-01 (Crítico):** o check-in `MANUAL` anônimo não exige prova de posição e aceita `ocorridoEm` retroativo de até 24 h. Três chamadas HTTP rendem uma avaliação válida.
- **SEG-02 (Alto):**
  - O feedback é aceito para **qualquer** visita encerrada sem conferir o dono, inclusive a de usuário logado. Como a RN-12 aceita uma avaliação por visita, isso bloqueia a avaliação legítima.
  - O checkout e o heartbeat de visita anônima também não conferem o dono, e o `ObjectId` é previsível.
  - **Correção (F1):** token aleatório da visita, devolvido no check-in e exigido nas chamadas anônimas; feedback só aceito do mesmo `usuarioId`/`dispositivoId`; testes de BOLA (ENG-04).
- **SEG-03 (Médio):** dá para descobrir se um e-mail tem conta. O cadastro responde 409 "Email já cadastrado." e o login só roda o BCrypt quando o e-mail existe, o que muda o tempo de resposta. Fechar isso é decisão de produto.

## 6. Recomendações acrescentadas em 18/10 (nenhuma decidida pelo PO)

- **Por que não Quarkus** (§12.4 do relatório):
  - A camada Spring do Quarkus **não cobre Spring Data MongoDB** (conferido na LTS 3.40.1), e a de segurança só cobre `@Secured`/`@PreAuthorize`, que o projeto não usa.
  - A migração seria **20–50 pessoa-dias**. Reescreveria 8 repositórios (29 métodos derivados), 32 chamadas de `MongoTemplate`, tipos GeoJSON em 9 arquivos, 25 índices, 18 regras de rota e 225 testes. Não resolve nenhum gargalo medido além do boot.
  - O Quarkus 4.0 está **previsto** para o fim de novembro de 2026; ainda não existe LTS 4.x.
  - **Reavaliar depois da Fase 3** se:
    - o boot continuar acima de 4–5 s e `min-instances=1` não for aceitável;
    - o Cloud Run passar de ~US$ 250/mês com CPU saturada e o profiler apontar o framework;
    - entrar alguém fluente em Quarkus, ou surgir um serviço fora do monólito;
    - o Quarkus passar a suportar Spring Data MongoDB.
  - **Antes de migrar:** prova de conceito de 2–3 dias com a primeira LTS 4.x. Migrar só com pelo menos 1,5× de req/s por instância, ou boot de até 2 s sem `min-instances`.
- **SOL-04 — boot sem trocar de framework:** `--cpu-boost`, jar extraído e cache AOT do Java 25 (F1); `min-instances=1` na produção (F3). Depois de ligar o cache AOT, medir p95 e vazão: no JDK 25 ele reduz a vazão durante o aquecimento (JDK-8386852).
- **SOL-09 (Médio) — e-mail em `@Async`:**
  - Os e-mails de confirmação e de senha são `@Async` e podem atrasar ou não sair, porque na cobrança por requisição do Cloud Run a CPU só existe durante uma requisição.
  - **Recomendação:** enviar o código do cadastro dentro da própria requisição; no "esqueci a senha" e no reenvio, também enviar dentro da requisição, com um tempo mínimo fixo de resposta. Usar Cloud Tasks só se os logs mostrarem falhas.
  - Se os logs do Resend mostrarem código **atrasado ou não entregue**, a severidade volta a Alto.
- **ADR-016 (proposto):** borda + catálogo local + Cloud Scheduler, no lugar de Upstash Redis + Cloud Tasks.
  - **Por quê:** a maior carga (APP-01) só some com o catálogo local, e o Redis não impede que a requisição chegue à origem. Custa ~US$ 5–30/mês na meta, contra dezenas a centenas, e tem menos peças para uma pessoa operar.
  - **Exceção:** Cloud Tasks só para o e-mail, se o SOL-09 B não bastar.
  - **Revisitar** se o acerto da borda ficar abaixo de 60% ou se os indicadores atrasarem mais de 15 min.
  - **Se aprovado:** registrar no `adrs.md` (que hoje vai até o ADR-015), marcar como substituídas as Fases 3 e 4 do plano de Cache/Fila e atualizar a Árvore Tecnológica para a v2.2.

## 7. Pendências do PO: as 15 perguntas do §17 do relatório

Nenhuma foi respondida até 18/10/2026. **Regra:** o PO só responde as perguntas de que discorda; as outras ficam com a sugestão. As respostas viram requisitos não funcionais mensuráveis no Documento Negocial v2.2 (ENG-01).

| # | Pergunta | Sugestão recomendada | Se a resposta for outra |
|---|---|---|---|
| P1 | O que mede "60–70%"? | Instalações ativas (~1,8–2,1 mi), com 10% de uso diário | Se for "pessoas ao mesmo tempo": arquitetura de evento permanente, M30+, custo 5–10× |
| P2 | "100 mil requisições" é por que unidade de tempo? | 100 mil/minuto (~1.700 req/s) como pico de evento a provar: a borda absorve a leitura e a origem fica em ~300–400 req/s | Por dia ou por hora, o sistema atual quase aguenta; por segundo, só com modo somente leitura |
| P3 | Prazo e plataformas | Android depois das Fases 0–4, por critério e não por data; iOS em seguida | Com data fixa, priorizar Críticos e Altos |
| P4 | Parceria com GDF/SES-DF ou crise sanitária? | O patamar de evento (P5) vira obrigatório se houver divulgação oficial, com runbook e modo somente leitura | Sem divulgação, vira só teste de sanidade |
| P5 | Teto de gasto | US$ 120/mês no lançamento e US$ 700/mês na meta, com alertas | Com teto menor, adiar `min-instances=1` |
| P6 | Mapa | MapLibre + PMTiles na borda antes do patamar P2 | Com Mapbox: teto de gasto e US$ 3–4 mil/mês na meta |
| P7 | Disponibilidade e equipe | 99,5%, RPO 24 h, RTO 4 h, só serviços gerenciados, sem plantão 24/7 | Com ≥ 99,9%: 2 zonas, M20+ com réplica e plantão |
| P8 | Atraso aceitável nos dados públicos | Até 5 min na borda; catálogo inteiro no app com ETag | Se precisar ser em tempo real, a origem precisa de ~2× a capacidade |
| P9 | LGPD | Tratar como dado sensível (art. 11); nomear encarregado; apagar os pontos de GPS ao encerrar a visita; fazer o RIPD | Se precisar dos pontos, guardar no máximo 30 dias, com TTL |
| P10 | Antifraude | A avaliação anônima continua, mas só conta no indicador com aparelho atestado e prova de presença | Se todas contarem igual, a metodologia precisa avisar |
| P11 | Conformidade e dados no Brasil | Sem exigência → Cloudflare | Com exigência → LB + Cloud CDN + Cloud Armor (+US$ 25–150/mês) |
| P12 | Decisões D1–D5 e ADR-016 | Aprovar como recomendadas | Com Upstash e Cloud Tasks: +US$ 20–150/mês e 2 peças a mais |
| P13 | Prova de carga na homologação | Autorizar, com teto de US$ 30, fora do horário dos testadores do beta | Negada: lançar só um beta controlado (P1) |
| P14 | Próximo passo | Aprovar o relatório, abrir o "Épico 9 — Escala, Segurança e Privacidade" e começar pelas Fases 0 e 1 | Se outra coisa vier antes: pelo menos SEG-01, SEG-02 e DAD-01 antes de divulgar |
| P15 | O Atlas aceita conexão de qualquer IP (`0.0.0.0/0`)? | Confirmar; usuário de menor privilégio; Private Service Connect a partir do M10 | Se já houver allowlist, o SEG-08 fecha |

**D1–D5** (Plano de Escala §8):
- **D1:** premissas de 10% de uso diário e 15% na hora de pico.
- **D2:** Cloudflare Free ou borda no GCP.
- **D3:** Mapbox ou MapLibre.
- **D4:** `min-instances=1` na produção (~US$ 15–70/mês; fecha o E8-01 do ADR-011).
- **D5:** autorizar a prova de carga.

**Verificações operacionais em aberto:**
- logs do Resend, para saber se há código atrasado ou não entregue (SOL-09);
- acesso de rede ao Atlas (SEG-08);
- configuração viva do Cloud Run (`cpu-throttling`).

## 8. Roteiro proposto (§14 do relatório)

"Fase N" sem qualificação se refere a este roteiro. O Plano de Escala (Fases 0–5) e o plano de Cache/Fila (Fases 0–6; a 3 é Redis e a 4 é Cloud Tasks) numeram as fases de outro jeito. Cada gap vira um PR para `develop`, e as Fases 0, 1 e 2 podem correr em paralelo.

- **Fase 0 — Decisões e guarda-corpos** (≈1 semana, custo zero):
  - Gaps: ENG-01, ENG-02, PERF-02, OPS-01, OPS-05, OPS-02 (jobs). O OPS-01 (alertas) vem antes de qualquer mudança.
- **Fase 1 — Destravar a escala e fechar a integridade** (≈3–4 semanas, código):
  - Gaps: SOL-02, SOL-04 B, SOL-05, SOL-07, SOL-09, ARQ-01 (`GET /api/v1/catalogo` com ETag, só no servidor), ARQ-02/03/04/05/07/08/09, SEG-01 (presença e atestação), SEG-02, SEG-03 (limites por destino e aparelho), DAD-01, ENG-04.
  - Pronta quando houver `--max-instances` > 1 sem corrida, rate limit por identidade, testes de BOLA verdes e retenção dos pontos de GPS.
- **Fase 2 — Borda, domínio e catálogo** (≈2–3 semanas, versão nova do app):
  - Gaps: SOL-03, ARQ-01 (app), ARQ-06, APP-01, APP-02, APP-03, OPS-03, SEG-03 (borda), SEG-05.
- **Fase 3 — Produção** (≈1–2 semanas):
  - Gaps: SOL-01, SOL-04 A, SOL-06, SOL-08, ARQ-07, DAD-02, DAD-03, SEG-04, SEG-06, SEG-07, SEG-08, OPS-02, OPS-04.
- **Fase 4 — Prova de carga** (≈1 semana + análise):
  - Gaps: PERF-01, PERF-03.
  - Roda na homologação depois das Fases 1–3, com o banco temporariamente em M10 e 3–4 geradores k6 em IPs e regiões diferentes, fora do horário do beta.
  - Inclui uma rajada de 0 a 6.000 req/s e um teste de resistência de 4 h. Custa menos de US$ 30.
- **Fase 5 — Reputação e antifraude contínuos** (SEG-01).
- **Fase 6 — Operação:** PERF-04 e APP-04 (iOS; conta Apple a US$ 99/ano).

**Critérios para o lançamento público:**
1. Nenhum gap crítico aberto.
2. Prova de carga aprovada no regime da meta e na rajada de evento, com erro ≤ 1% e p95 ≤ 300 ms na origem (o login fica fora dessa conta).
3. Restauração de backup testada, com o tempo registrado.
4. Alertas chegando ao celular do responsável.
5. RIPD concluído e política de retenção aplicada.

O lançamento é em Android; iOS vem depois.

## 9. Onde está cada coisa

| O quê | Caminho |
|---|---|
| Relatório desta sessão | `Documentos/02-arquitetura-tecnica/Analise-Escalabilidade-Seguranca-DF-v1.0.md` (+ `.pdf`) |
| Plano de escala anterior (08/10) | `Documentos/02-arquitetura-tecnica/Plano-Escala-Infraestrutura-DF-v1.0.md` (ADR-015) |
| Plano de cache/fila (09/09) | `Documentos/09-melhoria-continua/Plano-Implantacao-Cache-Fila-Resiliencia-v1.0.md`. Se o ADR-016 for aprovado, as Fases 3 (Upstash) e 4 (Cloud Tasks) saem. |
| Teste de carga de 23/09 | `Documentos/11-desempenho/Relatorio-Desempenho-HML-2026-09-23.md` |
| Pentest de 23/09 | `Documentos/12-seguranca/Pentest-HML-2026-09-23.md` |
| ADRs (registro único de decisões) | `Documentos/08-analise tecnica/adrs.md` |
| Histórico de melhorias (M-001 a M-046) | `Documentos/09-melhoria-continua/Historico-Melhorias.md` |
| Status das estórias | `Documentos/De-Para-Backlog-Features.md` |
| Fluxo de branches e ambientes | `Documentos/10-git-flow/MANUAL.md` |
| Ferramentas de carga | `perf/` (k6 + Prometheus + Grafana) |

## 10. Convenções e preferências

- **Git-flow:**
  - `feature/*`, `bugfix/*`, `hotfix/*` ou `doc/*` → PR para `develop`.
  - `develop` → `master` (homologação) só por PR que sai da própria `develop`.
  - `release/<versão>` nasce pelo `release.yml`.
  - O CI também roda em PR empilhado, com base `feature/**` ou `bugfix/**`.
- **CI:**
  - pelo menos 90% de cobertura nas linhas alteradas;
  - trava de contagem de testes: o total não pode cair, e código de produção alterado exige teste novo;
  - SonarQube Cloud para backend, mobile e admin;
  - GitHub Code Scanning, ativado em 18/10/2026.
- **Documentação:**
  - uma versão nova de documento ativo é um arquivo novo, e o antigo vai para `_historico/`;
  - auditorias declaram o commit-base;
  - o PR que entrega uma estória atualiza o `De-Para` no mesmo PR;
  - o `00-INDICE.md` é sempre atualizado.
- **Preferência do PO (18/10/2026):** não colocar atribuição do Claude em PRs e commits. Isso vale para o rodapé "Generated with Claude Code", o link da sessão e as linhas `Co-Authored-By` e `Claude-Session`. Os commits do PR #203 foram reescritos para tirá-las.
