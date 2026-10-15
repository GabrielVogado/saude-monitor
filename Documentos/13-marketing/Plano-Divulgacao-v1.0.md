# 📣 Plano de Divulgação — Radar Saúde v1.0

> | Campo | Valor |
> |---|---|
> | **Versão** | 1.0 |
> | **Data** | 23/09/2026 |
> | **Para quem** | Gabriel Vogado (PO) — escrito para quem **nunca fez marketing** |
> | **Ponto de partida** | App em homologação (`v1.0.0-rc.4`), ainda fora da Play Store; próxima etapa do produto é o **beta fechado (S12)** |
> | **Orçamento assumido** | R$ 0 a R$ 500 no total (quase tudo é tempo, não dinheiro) |
> | **Skills usadas** | Repositório [kursku/skills](https://github.com/kursku/skills) — as 10 escolhidas estão listadas no §9 |

---

## 1. A ideia central, em uma frase

> **Não tente ser conhecido no Brasil inteiro. Tente fazer 5 a 10 hospitais do DF terem nota e tempo de espera visíveis no app o mais rápido possível.**

Por quê: o app só mostra a nota de um hospital quando ele tem **pelo menos 5 avaliações** (regra N ≥ 5 do Documento Negocial). Se você espalhar 1.000 usuários pelo país, cada hospital fica com 0 ou 1 avaliação e o app parece **vazio** para quem abre. Se concentrar 300 usuários em poucas regiões do DF, os hospitais dessas regiões ganham nota, o app fica **útil**, e gente útil indica para outras pessoas.

Isso tem nome em marketing: **densidade antes de alcance**. É a regra que guia todas as decisões deste plano.

---

## 2. Glossário mínimo (só o que você vai ouvir)

| Termo | O que significa aqui |
|---|---|
| **Público-alvo** | Quem você quer que baixe o app. Aqui: moradores do DF que usam pronto-socorro (pacientes e acompanhantes). |
| **Proposta de valor** | O motivo, em uma frase, para alguém baixar. Ex.: *"Veja quanto tempo se espera em cada hospital do DF antes de sair de casa."* |
| **Canal** | Onde a mensagem chega à pessoa: grupo de WhatsApp, Instagram, jornal, boca a boca. |
| **Beta fechado** | Versão de teste para um grupo pequeno e escolhido, antes de abrir para todos. |
| **Early adopter** | Primeiros usuários, que toleram defeitos em troca de estar "por dentro". |
| **ASO** | *App Store Optimization* — fazer a página do app na Play Store aparecer na busca e convencer quem a visita a instalar. |
| **Ativação** | A pessoa não só instalou, mas **fez a coisa principal**: deu permissão de localização e teve uma visita detectada. |
| **Retenção** | A pessoa continua com o app instalado semanas depois. |
| **Pauta / release** | Uma sugestão de notícia enviada a um jornalista. |
| **Funil** | As etapas em sequência: viu → instalou → ativou → avaliou → indicou. Em cada etapa se perde gente. |

---

## 3. Antes de divulgar qualquer coisa — 5 bloqueios

Divulgar um app que falha **queima** as pessoas que você atraiu; elas não voltam. Resolva isto primeiro:

| # | Bloqueio | Por que importa | Como saber que está resolvido |
|---|---|---|---|
| B-1 | **App rápido e estável** | O teste com 100 usuários de 23/09 já deu p95 de 157 ms, então isso parece encaminhado. Falta o teste de campo (V-01, V-02…) em hospitais de verdade. | Validações do S11 aprovadas. |
| B-2 | **Play Store: localização em segundo plano** | O Google exige uma **declaração** justificando `ACCESS_BACKGROUND_LOCATION`, com **vídeo curto** mostrando o recurso. Apps de saúde também preenchem uma declaração própria. Sem isso, a publicação é recusada. | App aprovado pelo menos na faixa de **teste fechado** da Play Console. |
| B-3 | **LGPD — dado sensível** | Localização em hospital + avaliação de atendimento **revela informação de saúde**, que a LGPD trata como dado sensível. Política de privacidade clara é pré-requisito, e é também argumento de confiança na divulgação. | Política publicada em link público; skill `lgpd-compliance-check` rodada sobre ela. |
| B-4 | **Risco com os hospitais** | Um ranking público pode incomodar instituições. A defesa é a **transparência de método** que o app já tem (N mínimo, data da medição). Nunca use frases como *"o pior hospital do DF"* na divulgação. | Página "Como calculamos" publicada; textos de divulgação revisados com a lista do §8. |
| B-5 | **Um lugar para mandar as pessoas** | Todo post precisa de um link. Sem site, use por enquanto a página da Play Store (ou do teste fechado). | Link curto único para instalar (ex.: página na Play Store). |

---

## 4. Quem é o público (e por onde chegar nele)

Baseado nas personas do Documento Negocial:

| Persona | O que ela quer ouvir | Onde ela está |
|---|---|---|
| **Marina, 34, paciente** | "Saiba antes de ir quanto tempo vai esperar." | Instagram, grupos de WhatsApp do bairro/condomínio, grupos de mães. |
| **Carlos, 28, acompanhante do pai idoso** | "Não precisa fazer nada: o app percebe sozinho que você está no hospital." | WhatsApp da família, Facebook, grupos de cuidadores. |
| **Dra. Renata, 41, gestora** | "Um termômetro gratuito do que o paciente sente." | LinkedIn, associações de hospitais. (**Deixe para depois** — não é público do MVP.) |

**Mensagem principal (use em tudo):**

> **Radar Saúde — veja quanto tempo se espera e como é o atendimento em cada hospital do DF, medido por quem esteve lá.**

**Três frases de apoio** (escolha uma por post):

1. *"Você não aperta nada: o app percebe quando você entra e sai do hospital."*
2. *"Na saída, 4 perguntas em 45 segundos. Dá para pular."*
3. *"Sua avaliação é anônima e ajuda a próxima pessoa a decidir."*

---

## 5. O plano em 4 fases (12 semanas)

A estrutura segue a skill `launch-strategy` (fases interna → beta → lançamento) adaptada para o seu caso.

### Fase 0 — Preparar a casa (semanas 1–2)

**Objetivo:** ter o mínimo para não desperdiçar ninguém.

- [ ] Resolver os bloqueios B-2 a B-5 do §3.
- [ ] Criar um **perfil no Instagram** `@radarsaude.df` (ou parecido) e **uma comunidade no WhatsApp** "Radar Saúde — Beta" (skill `whatsapp-community`).
- [ ] Escrever a **página da Play Store** (skill `aso-app-store`): título com a palavra que as pessoas buscam ("tempo de espera hospital"), descrição curta, 4–5 capturas de tela mostrando mapa, detalhe do hospital e formulário de 45 s.
- [ ] Escolher **3 regiões do DF** para concentrar esforço (ex.: onde você e seus conhecidos moram ou trabalham, e onde há hospitais cadastrados com mais movimento).
- [ ] Preparar uma **planilha simples de métricas** (colunas do §7).

### Fase 1 — Beta fechado com conhecidos (semanas 3–6)

**Objetivo:** pelo menos 50 pessoas usando de verdade durante 30 dias; descobrir o que quebra e o que confunde. Corresponde à sprint S12 (validação V-09 do `Plano-Sprints-v2.1` §22.4).

- [ ] Recrutar **pessoalmente**, uma a uma: família, amigos, colegas, vizinhos — priorizando quem vai a hospital com frequência (quem cuida de idoso, pais de criança pequena, profissionais de saúde). Skill: `beta-launch-plan` (seção "Recrutamento").
- [ ] Mandar para cada um uma **mensagem pessoal**, não um texto genérico (modelo no §10).
- [ ] Colocar todos na comunidade de WhatsApp e explicar a **"missão"**: *instalar, permitir a localização "o tempo todo" e, na próxima ida a um hospital, responder o formulário.*
- [ ] Toda semana, mandar no grupo **o que foi corrigido graças a eles** ("Obrigado à Ana, corrigimos X"). Isso mantém gente engajada.
- [ ] Na semana 5, fazer **5 conversas de 15 minutos** perguntando: *o que você achou que o app fazia? Em que momento ficou confuso? Indicaria para quem?*

**Critério para passar de fase:** a V-09 aprovada (**≥ 50 usuários reais por 30 dias, taxa de resposta de feedback ≥ 25% e retenção D7 ≥ 30%**) e, para a divulgação fazer sentido, **3 hospitais com N ≥ 5** e **60% dos testadores com localização ativa**. Se não atingir, fique mais tempo nesta fase; não pule.

### Fase 2 — Lançamento público no DF (semanas 7–8)

**Objetivo:** chegar a 300–500 usuários nas 3 regiões escolhidas.

- [ ] **Imprensa local** (skill `press-outreach`): a história é boa para veículos do DF — *"Morador do DF cria app que mede o tempo de espera real nos hospitais"*. Envie a pauta (modelo no §10) para 5 a 10 jornalistas de cidade/saúde. Ter **números reais do beta** ("em 30 dias, 55 pessoas registraram 120 visitas") aumenta muito a chance de sair matéria.
- [ ] **Grupos de WhatsApp e Facebook** das regiões escolhidas: peça aos beta testers para compartilharem **nos grupos em que já estão** — um membro postando vale mais que um estranho. Dê a eles um texto pronto e uma imagem.
- [ ] **Instagram:** 3 posts por semana. Ideias: "como funciona em 3 passos", "quanto tempo se esperou no Hospital X esta semana" (só quando tiver N ≥ 5), "por que sua avaliação é anônima".
- [ ] **Reddit** (`r/brasilia`) e fóruns locais: um post honesto, do tipo *"fiz um app e queria a opinião de vocês"*, funciona melhor que anúncio.

### Fase 3 — Crescer com o que funcionou (semanas 9–12)

**Objetivo:** fazer o app crescer por indicação, não só pelo seu esforço.

- [ ] **Indicação dentro do app** (skill `viral-loop-design`): depois de responder o formulário, mostrar *"Sua avaliação ajudou o Hospital X a ter nota pública. Chame alguém para ajudar também"* com botão de compartilhar no WhatsApp. É uma mudança pequena no app e é o canal mais barato que existe.
- [ ] **Parcerias** (skill `partnership-growth`): associações de moradores, associações de pacientes (ex.: renais crônicos, oncologia, que vão muito a hospital), centros acadêmicos de Medicina/Enfermagem/Saúde Coletiva, conselhos locais de saúde. Ofereça algo em troca: um relatório mensal com os dados agregados da região.
- [ ] Olhar a planilha do §7 e **dobrar o esforço no canal que trouxe mais gente ativada**; cortar o que não trouxe ninguém.
- [ ] Só agora, se quiser, testar **R$ 100–300 em anúncio** no Instagram segmentado para as regiões do DF, para ver quanto custa cada instalação. Não antes disso.

---

## 6. O que NÃO fazer (erros comuns de iniciante)

1. **Anunciar antes do app funcionar bem.** Quem tem uma experiência ruim não volta, e comenta.
2. **Pagar anúncio no começo.** Sem saber qual mensagem funciona, é dinheiro jogado fora.
3. **Espalhar por vários estados.** Quebra a regra do §1.
4. **Estar em todas as redes.** Instagram + WhatsApp bastam. TikTok, LinkedIn, X ficam para depois.
5. **Falar mal de hospitais nomeados.** Mostre dados; não faça julgamentos.
6. **Esconder o pedido de localização.** Explique antes, com clareza, *por que* o app precisa dela "o tempo todo". É o passo onde mais gente desiste.
7. **Sumir do grupo do beta.** Silêncio de 2 semanas = grupo morto.

---

## 7. Como medir (planilha semanal)

Uma linha por semana, estas colunas:

| Métrica | Onde ver | Meta semana 6 | Meta semana 12 |
|---|---|---|---|
| Instalações totais | Play Console | 50 | 500 |
| Taxa de resposta de feedback (V-09) | backend | ≥ 25% | ≥ 25% |
| Retenção D7 (V-09) | analytics (E8-11) | ≥ 30% | ≥ 30% |
| % com localização "o tempo todo" | backend (consentimentos) | 60% | 50% |
| Visitas detectadas na semana | backend | 20 | 150 |
| Feedbacks respondidos na semana | backend | 15 | 100 |
| **Hospitais com N ≥ 5** ⭐ | backend | 3 | 10 |
| Nota da Play Store | Play Console | — | ≥ 4,3 |
| De onde veio (pergunte no onboarding ou no grupo) | manual | — | — |

⭐ **Hospitais com N ≥ 5 é a métrica mais importante do plano.** Se ela sobe, o app está ficando útil; se não sobe, nada mais importa.

> A maioria desses números sai do banco que o app já tem. Um endpoint administrativo simples (ou uma consulta no Mongo) basta; não precisa de ferramenta de analytics paga agora.

---

## 8. Cuidados específicos de saúde (checklist antes de publicar qualquer texto)

Adaptado da skill `healthcare-marketing`:

- [ ] O texto informa, não promete ("veja o tempo médio relatado", nunca "evite esperas").
- [ ] Nenhum hospital é chamado de "pior", "melhor", "evite".
- [ ] Números sempre com a fonte e a data ("média de 12 visitas registradas entre 01 e 15/10").
- [ ] Nenhum depoimento ou foto de paciente sem autorização por escrito.
- [ ] Fica claro que o app **não é serviço de emergência**: *"Em emergência, ligue 192."*
- [ ] Link para a política de privacidade em toda página de captação.

---

## 9. As skills escolhidas e como usar cada uma

Das ~1.850 skills do repositório [kursku/skills](https://github.com/kursku/skills), estas 10 são as que servem para um app gratuito, de saúde, local e em pré-lançamento. Elas não ficam neste repositório, porque `.claude/` está no `.gitignore` por decisão do PO. Para usar, baixe o `SKILL.md` de cada uma no kursku/skills (as de `launch-strategy` e `marketing-ideas` ficam em `packs/global-skillshare-import/wave-008/`; as demais, em `packs/kit-510-ptbr/`). No Claude Code, coloque o arquivo em `.claude/skills/<nome>/SKILL.md` na sua máquina; no claude.ai, envie-o em **Personalizar → Habilidades**.

| Fase | Skill | Para que serve aqui | Exemplo de pedido ao Claude |
|---|---|---|---|
| Base | `launch-strategy` | Estrutura das fases e checklist de lançamento (base deste plano). | *"Revise o Plano-Divulgacao-v1.0 e me diga o que falta para a Fase 2."* |
| Base | `healthcare-marketing` | Ética e regras de divulgação em saúde. | *"Revise este post do Instagram contra as regras de marketing de saúde."* |
| 0 | `lgpd-compliance-check` | Revisar a política de privacidade e os consentimentos. | *"Revise a política de privacidade do app considerando localização + dado de saúde."* |
| 0 | `aso-app-store` | Título, descrição e capturas da Play Store. | *"Escreva o título, a descrição curta e a longa do Radar Saúde para a Play Store."* |
| 0–1 | `whatsapp-community` | Montar e moderar a comunidade do beta. | *"Monte a estrutura da comunidade WhatsApp do beta e a mensagem de boas-vindas."* |
| 1 | `beta-launch-plan` | Recrutar, integrar e ouvir os beta testers. | *"Crie o roteiro das entrevistas de 15 minutos com beta testers."* |
| 2 | `press-outreach` | Pauta para jornalistas e follow-up. | *"Escreva a pauta para jornalistas de saúde do DF com estes números do beta: …"* |
| 3 | `viral-loop-design` | Indicação dentro do app, após o feedback. | *"Proponha o fluxo de compartilhamento pós-feedback e o texto do convite."* |
| 3 | `partnership-growth` | Parcerias com associações e universidades. | *"Liste 15 associações de pacientes e moradores do DF e escreva o convite de parceria."* |
| Qualquer | `marketing-ideas` | Banco de 140 ideias com nota de viabilidade por fase. | *"Sugira 5 ideias de marketing para um app pré-lançamento com R$ 0."* |

**Skills que avaliei e deixei de fora:** as de tráfego pago (Google/Meta Ads), funis de venda, e-mail marketing, precificação e Product Hunt. Servem para produto pago ou para público de tecnologia, e o Radar Saúde é gratuito e voltado ao cidadão comum. Voltam a fazer sentido se o painel para hospitais (fase 2 do negócio) sair do papel.

---

## 10. Modelos prontos

### 10.1 Convite pessoal para o beta (WhatsApp)

```
Oi, [nome]! Tudo bem?

Estou terminando um app chamado Radar Saúde: ele mostra quanto tempo
se espera e como é o atendimento nos hospitais do DF, com base em
quem esteve lá.

Estou chamando umas 60 pessoas de confiança para testar antes de
lançar. Você vai a hospital de vez em quando (com você ou com alguém
da família)? Se topar, te mando o link e te coloco no grupo do teste.

Leva 2 minutos para instalar, e na saída do hospital são 4 perguntas.
Sua opinião vai mudar o app de verdade.
```

### 10.2 Texto para os beta testers repassarem nos grupos

```
Gente, estou testando um app do DF que mostra o tempo de espera e a
nota de atendimento dos hospitais, a partir de quem esteve lá.
Não precisa fazer nada: ele percebe quando você entra e sai, e na
saída pergunta 4 coisas rapidinho (dá para pular). É anônimo.

Quanto mais gente usa, mais hospitais ganham nota. Link: [link]
```

### 10.3 Pauta para jornalista (e-mail curto)

```
Assunto: App criado no DF mede tempo real de espera em hospitais

Olá, [nome]. Vi sua matéria sobre [tema recente de saúde no DF].

O Radar Saúde é um aplicativo gratuito, criado aqui no DF, que usa
a localização do celular para medir quanto tempo as pessoas realmente
ficam em cada hospital, e pede uma avaliação de 45 segundos na saída.
As médias só aparecem com pelo menos 5 avaliações, e a metodologia
é pública.

Em [N] semanas de teste, [X] pessoas registraram [Y] visitas em
[Z] hospitais. Posso mostrar os números e explicar como funciona.

[Seu nome] · [telefone] · [link]
```

---

## 11. Resumo de uma página (cole na geladeira)

1. **Semanas 1–2:** Play Store aprovada, política de privacidade publicada, Instagram + grupo de WhatsApp criados, 3 regiões do DF escolhidas.
2. **Semanas 3–6:** 50+ conhecidos testando por 30 dias; conversar com eles toda semana; só avançar com a **V-09 aprovada** e **3 hospitais com N ≥ 5**.
3. **Semanas 7–8:** jornal local + beta testers compartilhando nos grupos deles + Instagram 3x/semana.
4. **Semanas 9–12:** botão de indicação no app, parcerias com associações, reforçar o canal que funcionou.
5. **Toda sexta:** preencher a planilha. A métrica que manda é **hospitais com N ≥ 5**.
