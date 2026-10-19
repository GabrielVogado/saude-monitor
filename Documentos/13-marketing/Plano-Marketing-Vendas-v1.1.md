# 💼 Plano de Marketing e Vendas — Radar Saúde v1.1

> | Campo | Valor |
> |---|---|
> | **Versão** | 1.1 |
> | **Data** | 19/10/2026 |
> | **Status** | 🟡 Proposta |
> | **Para quem** | Gabriel Vogado (PO) |
> | **Base conferida** | `develop@42e90d8` (homologação `v1.0.0-rc.6`) |
> | **Complementa** | [`Plano-Divulgacao-v1.0.md`](./Plano-Divulgacao-v1.0.md), que continua valendo para a frente de usuários. Este documento acrescenta a frente de receita e refaz o calendário até o lançamento público de **março de 2027**. |
> | **Documentos lidos** | README, `Documento-Negocial-v2.1.md`, `Plano-Divulgacao-v1.0.md`, `homologacoes/v1.0.0-rc.6.md`, `Plano-Sprints-v2.2.md`, `Backlog-MVP-v2.2.md`, `Features-MVP-v2.3.md`, `site/public/privacidade/` |

---

## 1. O que o produto é

- App mobile gratuito que mede, por GPS, quanto tempo a pessoa fica no hospital e, na saída, faz 4 perguntas em até 45 s, que dá para pular (`Documento-Negocial-v2.1.md` §1). Mostra por hospital a nota média e o tempo mediano de espera, só com 5 avaliações ou mais (RN-15, N ≥ 5), com data e método à vista.
- Para quem: moradores do DF que usam pronto-socorro (pacientes e acompanhantes). Gestores de hospital e poder público são público futuro (fases 2 e 3 do Documento Negocial).
- Estágio: homologação (`v1.0.0-rc.6`, 19/10/2026). Ainda não está na Play Store. Faltam a validação pré-lançamento (S11, V-01 a V-08) e o beta fechado (S12, ≥ 50 usuários por 30 dias). O painel admin web existe, mas é interno.
- Dinheiro: os documentos de negócio não definem receita. Em 19/10/2026 o PO definiu três fontes: poder público, anúncios no app e cupons de comércios depois do feedback. Preços ainda não definidos.

## 2. Ponto de partida

- Contas da Dev Point: Instagram com ~42 seguidores e LinkedIn com ~18. É um público de TI e empresas, não de pacientes do DF, e não serve para lançar o app ao cidadão.
- O que o Radar Saúde tem de mais forte é a **densidade local** (poucos hospitais com nota antes de ter muita gente, regra central do Plano de Divulgação v1.0) e a rede pessoal do PO.
- Sem anúncio pago antes de ter app estável e hospitais com nota. Sem número inflado em nenhum material.

## 3. Duas frentes

**Frente A: conseguir usuários (marketing).** Sem usuário não há dado, sem dado não há nota, sem nota não há nada para vender. Segue o Plano de Divulgação v1.0, com os ajustes da seção 6.

**Frente B: receita (decisão do PO, 19/10/2026).** O app segue gratuito para o cidadão e rende de três fontes:

1. **Poder público** (secretarias, conselhos de saúde): relatório agregado por região e hospital. Venda longa, que só anda com volume de dados. Começa com conversa e piloto, sem preço fixo.
2. **Cupons de comércios** (pequenos e grandes), liberados depois que o usuário conclui o feedback. O comércio paga pela campanha ou por cupom resgatado (modelo de preço a definir). Vender primeiro aos pequenos comércios perto dos hospitais das 3 regiões do beta (farmácia, lanchonete, estacionamento, mercado), depois às redes.
3. **Anúncios no app**: só depois de ter uso recorrente. Rendem pouco com poucos usuários, então ficam por último.

Hospitais como cliente (painel pago, fase 2 do Documento Negocial) ficam como quarta opção, não como foco.

## 4. Regras que protegem o produto

Precisam estar valendo **antes** de vender qualquer cupom ou anúncio.

- **Decidido (PO, 19/10/2026):** o cupom vale para qualquer nota, desde que o feedback seja concluído. O cupom premia **concluir** o feedback, nunca a nota. Mesmo cupom para nota 1 e nota 5; senão o indicador perde credibilidade e vira fraude.
- **Decidido (PO, 19/10/2026):** para receber cupom o usuário precisa estar logado no aparelho; os cupons ficam numa aba dedicada até expirarem.
  - Ponto de produto: hoje o login é opcional e o feedback pode ser anônimo (RN-13, RN-20, estória E3-05). O vínculo conta-cupom deve ficar separado da avaliação publicada (nota nunca exibida com identidade), e quem não tem login continua podendo avaliar, só não recebe cupom.
  - RN-12 (um feedback por visita) e SEG-01 (só avaliação com prova de presença entra no indicador, `Especificacao-API-v2.4.md`) já impedem o caminho mais simples de fraude.
- Anúncio e cupom **não podem usar a localização em hospital nem a nota dada** para segmentar. É dado de saúde, sensível pela LGPD. Segmentar por região ampla ou não segmentar.
- **A política de privacidade atual proíbe o modelo de receita.** `site/public/privacidade/index.html` diz: *"Não usamos seus dados para publicidade e não os vendemos."* Antes de qualquer piloto de cupom ou anúncio, a política e o consentimento do onboarding (E5-02) precisam ser reescritos para citar o uso comercial, e a nova versão passa por revisão LGPD. Conferir também as regras de anúncios da Play Store para apps de saúde.
- Nenhum anunciante, comércio ou órgão público influencia nota, tempo ou ordem dos hospitais. Isso precisa estar escrito na explicação "Como calculamos".

## 5. Público e posicionamento

- **Quem usa:** Marina (paciente) e Carlos (acompanhante). Promessa: *"Veja quanto tempo se espera em cada hospital do DF, medido por quem esteve lá."*
- **Quem paga:**
  - Comércios perto dos hospitais. Promessa: *"Seu cupom chega a quem acabou de ser atendido na sua região, sem anúncio genérico."*
  - Órgãos públicos de saúde. Promessa: *"Dado contínuo de tempo de espera e percepção do paciente por região, com método público."*
- **Diferenciais verificáveis:** tempo medido por GPS e não declarado; 45 s e anônimo; método público (N ≥ 5, mediana, data); avaliação só conta com prova de presença (SEG-01, na rc.6).
- **Cuidados de saúde e LGPD:** nunca "pior" ou "melhor hospital"; sempre fonte e data; "emergência: 192"; política de privacidade em todo link.

## 6. Canais viáveis com pouco alcance

| Canal | Uso | Esforço |
|---|---|---|
| Mensagem pessoal no WhatsApp (convite 1 a 1) | Recrutar os 50 do beta: quem cuida de idoso, pais de criança, profissionais de saúde | Alto, mas é o que funciona |
| Comunidade de WhatsApp do beta | Retenção e feedback semanal | Baixo |
| Grupos de bairro, condomínio, igreja e associações (via testadores) | Chegar a 300 a 500 pessoas no DF | Médio |
| Imprensa local do DF (só com números reais do beta) | Credibilidade | Médio |
| Perfil novo do Radar Saúde no Instagram | Prova social e explicação, sem meta de seguidores no começo | Baixo |
| LinkedIn do PO e da Dev Point | Só para abrir conversa com gestores e conselhos | Baixo |
| Anúncio pago | Adiado até o custo por instalação ser testável (R$ 100 a 300) | — |

Ajuste ao Plano de Divulgação v1.0: o convite do beta pede **uma coisa por vez** (instalar; permitir a localização "o tempo todo"; avaliar na próxima ida ao hospital). É o passo em que mais gente desiste.

## 7. Calendário até o lançamento público (20/10/2026 a março de 2027)

O lançamento público em março de 2027 dá cerca de 20 semanas, mais folga que as 12 semanas do Plano de Divulgação v1.0. O calendário abaixo encaixa as fases daquele plano nas datas reais e põe a frente de receita em paralelo.

### Fase 1 — Destravar (20/10 a 30/11/2026)

Nada aqui depende de usuário. Estes itens bloqueiam qualquer divulgação.

- Rodar o roteiro da rc.6 (`homologacoes/v1.0.0-rc.6.md` §3) e iniciar V-01 a V-08 (PO).
- **Site com Política de Privacidade, Termos e exclusão de conta no ar.** O conteúdo está pronto no repositório desde o PR #195 (`site/`); o PO publica com `wrangler deploy` e confere `https://saudemonitor.dev/privacidade`, `/termos` e `/exclusao-de-conta` (passo de conta do PO). Não é trabalho de escrita: a política só volta a mudar na Fase 2.
- Play Store: declaração de localização em segundo plano com vídeo curto e serviço em primeiro plano (passos de conta do PO).
- **Criar a explicação "Como calculamos".** Está prevista em `Features-MVP-v2.3.md` (F-06, item 10: link "Como calculamos?" na tela pública), mas não existe no app nem no site. Precisa entrar como item de produto e trazer a frase de que nenhum anunciante influencia a nota.
- Escolher 3 regiões do DF e a lista de 60 pessoas para o beta. Criar a comunidade de WhatsApp e o perfil do Instagram.
- Marcar 3 conversas de 20 min com pessoas de conselho ou secretaria de saúde (rede pessoal, LinkedIn) e listar 20 comércios perto dos hospitais das 3 regiões. Só ouvir: quem decide, o que pagaria.

### Fase 2 — Preparar o cupom e a política (dezembro de 2026)

- **Abrir o item de produto do cupom pós-feedback.** Hoje ele não existe em nenhum documento nem no código (busca por "cupom" na `develop@42e90d8` sem resultado). Escopo mínimo: cupom liberado ao concluir o feedback, só para usuário logado, aba de cupons com validade, vínculo conta-cupom separado da avaliação.
- **Reescrever a política de privacidade e o consentimento** para o uso comercial (seção 4) e pedir a revisão LGPD. Nenhuma oferta a comércio sai antes disso.
- App em teste fechado na Play Store, pronto para receber os testadores.

### Fase 3 — Beta fechado e primeiros pilotos (janeiro e fevereiro de 2027)

- Beta fechado (S12, V-09) com 50 pessoas por 30 dias, mensagem semanal "corrigimos X graças a você".
- 5 entrevistas de 15 min com testadores.
- Oferecer o piloto gratuito de cupom (60 dias) a 3 a 5 comércios, só com o cupom implementado e a política revisada publicada.
- Mostrar aos órgãos públicos os primeiros dados agregados do beta, só de hospitais com N ≥ 5.
- Conteúdo: 2 posts por semana no perfil novo ("como funciona em 3 passos", "por que a avaliação é anônima", "como calculamos"). Nenhum nome de hospital com nota antes de N ≥ 5.

### Fase 4 — Lançamento público no DF (março de 2027)

Só começa se o critério de saída do beta do Plano de Divulgação v1.0 (§5, Fase 1) for atingido: V-09 aprovada, **3 hospitais com N ≥ 5** e 60% dos testadores com localização ativa. Se não atingir, o beta continua e o lançamento espera.

- Imprensa local com números reais do beta, grupos de bairro via testadores, Instagram 3 vezes por semana (Plano de Divulgação v1.0, Fase 2).
- Primeiras propostas pagas aos comércios do piloto, com os resgates reais na mão.
- Anúncio pago (R$ 100 a 300) só depois, para medir custo por instalação.

## 8. Funil de venda

**Comércio (cupom)**

1. Lista de 20 comércios perto dos hospitais das regiões do beta.
2. Visita ou WhatsApp do PO com a oferta: "seu cupom chega a quem acabou de sair do hospital da sua região".
3. Piloto gratuito de 60 dias com 3 a 5 comércios, durante o beta.
4. Mostrar resgates reais.
5. Proposta paga.

Objeções esperadas:

- *"Quantas pessoas vão ver?"* Resposta honesta: o beta é pequeno, por isso o piloto é grátis.
- *"Não quero associar minha marca a hospital."* O cupom aparece só depois do feedback e não cita o hospital.

**Poder público**

1. Conversas com conselhos e secretarias ligados à saúde.
2. Mostrar dados agregados do beta (só com N mínimo).
3. Piloto de relatório regional.
4. Proposta de contrato. Prazo longo; não esperar receita antes do lançamento.

Cada contato vai numa planilha (nome, cargo, etapa, objeção). Todo texto passa pelo PO e é enviado por ele.

## 9. Métricas

- **Usuários** (as do Plano de Divulgação v1.0 §7): instalações (meta na semana 6 do beta: 50), resposta ao feedback ≥ 25%, retenção D7 ≥ 30%, **hospitais com N ≥ 5 (meta: 3 no fim do beta; 10 três meses depois)**.
- **Vendas:** comércios contatados (20), pilotos de cupom aceitos (meta: 2 até o fim do beta), conversas com órgãos públicos (3 na Fase 1), cupons resgatados por feedback concluído (taxa a medir). Receita antes do lançamento: não esperar.
- **Regra:** sem hospitais com N ≥ 5 não se vende nada, só se conversa.

## 10. Riscos

| Risco | Como tratar |
|---|---|
| Beta pequeno demais e hospitais sem nota | Concentrar em 3 regiões; não lançar sem 3 hospitais com N ≥ 5 |
| Resistência de hospitais | Método público e linguagem de "termômetro", não de ranking |
| LGPD (dado de saúde) e política atual que proíbe publicidade | Política e consentimento revisados antes de qualquer oferta comercial |
| Cupom virar incentivo a avaliação falsa | Cupom igual para qualquer nota, só com feedback concluído, SEG-01 e RN-12 |
| Comprador errado | Tratado nas conversas de escuta da Fase 1 |
| Cupom não ficar pronto antes de março | Piloto de cupom passa para depois do lançamento; a Frente A não depende dele |

## 11. Decisões registradas

| Data | Decisão do PO |
|---|---|
| 19/10/2026 | Receita por poder público, cupons de comércios após o feedback e anúncios no app |
| 19/10/2026 | O cupom vale para qualquer nota e exige feedback concluído |
| 19/10/2026 | Receber cupom exige login; cupons ficam numa aba dedicada até expirarem |
| 19/10/2026 | Lançamento público em março de 2027 |
