# Roteiro de Testes de Campo — Pulseira Verde v1.0

> **Versão:** 1.0 · **Data:** 12/11/2026 · **Base:** `develop` no commit 9895e5a (rc.15) · **Executor:** PO
> **Complementa** o roteiro §3 de cada rc em [`homologacoes/`](./homologacoes/), sem substituí-lo: aqui o foco é o que só se prova **andando com o aparelho** (geofence, GPS, fila offline, notificações).

Regras de negócio citadas: RN-01 (entrada após 2 min dentro), RN-03 (saída após mais de 5 min fora),
RN-06 (45 min sem sinal vira `GPS_INTERROMPIDO`; checkout tardio em até 24h corrige para `FINALIZADA`),
RN-08 (convite de avaliação 1 min após a saída), RN-09 (24h para avaliar, 15 dias para editar),
RN-23 (heartbeat). Fonte: `Documento-Negocial-v2.1.md`.

---

## 0. Antes de sair de casa

### 0.1 Material

- Aparelho Android com o APK HML mais recente da página Releases (`radar-saude-hom-<rc>.apk`), instalado **por cima** da anterior.
- Uma conta de teste (e-mail e senha) e, para o bloco de visita sem login, o app deslogado.
- Um segundo meio de ver as horas (relógio) e este documento aberto ou impresso. **Anotar a hora de cada entrada, saída e notificação**: é com ela que se mede a tolerância.
- Acesso ao Histórico do app e, se possível, ao Sentry (ambiente `hom`).
- Bateria acima de 50% e economia de bateria **desligada** para o app (Configurações > Apps > Pulseira Verde > Bateria > Sem restrições).

### 0.2 Permissões e estado do aparelho

- [ ] Localização em **"Permitir o tempo todo"** e localização precisa ligada.
- [ ] Notificações permitidas.
- [ ] Versão do app conferida em Perfil: ______________ (deve bater com a rc testada).
- [ ] Hospital escolhido: ______________________ · Horário de chegada previsto: ______
- [ ] "Fechar o app" significa **fechar pela lista de recentes**, não só minimizar.

### 0.3 Quais testes dependem de PR ainda não mergeado

| Bloco | Depende de | Situação em 12/11 |
|---|---|---|
| 6 (fila enviada com o app fechado) | PR #255 (M-075, expo-background-task) | **Aberto, não está na rc.15.** Só executar com o APK DEV/CD gerado da branch ou de uma rc posterior que o contenha. Antes disso, marcar N/A. |
| Demais blocos | rc.15 (develop) | Disponíveis |

### 0.4 Como preencher

Cada teste tem **Pré-condição**, **Passos**, **Esperado** e o campo **Resultado**: marcar `OK`, `FALHOU` ou `N/A` e anotar horários e o que viu. Em falha: tirar print, anotar a hora exata e, se possível, guardar o evento do Sentry.

---

## 1. Check-in e saída automáticos (app fechado)

### TC-01 · Check-in automático com internet

- **Pré-condição:** 0.2 cumprido; logado; começa fora do hospital, a mais de 500 m; app **fechado**.
- **Passos:**
  1. Ir até o hospital e entrar na área. Anotar hora de entrada: ______
  2. Ficar dentro, com o app fechado, por pelo menos 5 min.
  3. Abrir o app.
- **Esperado:** em até cerca de 2 min após a entrada (RN-01) surge a notificação "Visita em andamento" (nome do hospital); o detalhe do hospital mostra "Check-in automático ativo" com temporizador e **sem** o botão "Não estou aqui"; a notificação diz "Registrando que você continua no hospital".
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Hora da notificação: ______ · Anotações: ____________________

### TC-02 · Saída automática e hora real do checkout

- **Pré-condição:** TC-01 em andamento; app fechado.
- **Passos:**
  1. Sair da área do hospital e seguir até pelo menos 300 m. Anotar hora de saída: ______
  2. Não abrir o app. Anotar hora em que chegar a notificação de avaliação: ______
  3. Abrir o Histórico.
- **Esperado:** checkout em até cerca de 10 min após sair (2 min até a 1ª leitura fora, 5 min de tolerância, leitura seguinte), e não ~30 min como na rc.6. A visita no Histórico termina **na hora da saída**, não na hora do checkout, e fica `Finalizada` com a permanência real.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Hora do checkout vista no Histórico: ______ · Anotações: ____________________

### TC-03 · Saída curta não encerra a visita (RN-03)

- **Pré-condição:** visita automática ativa.
- **Passos:** sair da área, ficar fora por **menos de 5 min** (ex.: calçada) e voltar.
- **Esperado:** a visita continua a mesma, sem checkout e sem nova visita; o temporizador segue contando.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Tempo fora: ______ · Anotações: ____________________

### TC-04 · Passagem rápida não gera visita (RN-01)

- **Pré-condição:** sem visita ativa; app fechado.
- **Passos:** atravessar a área do hospital em menos de 2 min (andando ou de carro) e sair.
- **Esperado:** nenhuma visita criada e nenhum convite de avaliação.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-05 · Visita longa (mais de 15 min, sessão vencida)

- **Pré-condição:** logado; app fechado; internet ligada.
- **Passos:** ficar **mais de 15 min** (vence o token) e até uns 50 min no hospital; sair.
- **Esperado:** no Histórico a visita é `Finalizada` com o tempo real, **não** `GPS interrompido`. Os sinais da visita seguem sendo aceitos depois dos 15 min (correção M-070).
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Duração no Histórico: ______ · Anotações: ____________________

### TC-06 · Visita sem login

- **Pré-condição:** app deslogado (sair pelo Perfil).
- **Passos:** repetir TC-01 e TC-02; avaliar a visita ao final.
- **Esperado:** check-in, checkout e avaliação funcionam do começo ao fim, sem login.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-07 · Dois hospitais próximos / sobrepostos

- **Pré-condição:** estar perto de hospitais com geofences sobrepostos (se houver no trajeto).
- **Passos:** entrar na região comum e sair por um dos lados.
- **Esperado:** uma saída de um hospital **não** encerra a visita do outro; só uma visita ativa por vez.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

---

## 2. GPS e check-in manual

### TC-08 · Check-in manual dentro do hospital

- **Pré-condição:** dentro do hospital, GPS ligado, sem visita automática ativa.
- **Passos:** abrir o detalhe do hospital > fazer check-in manual; depois tocar em "Não estou aqui".
- **Esperado:** visita manual com temporizador; "Não estou aqui" encerra a visita; avaliação liberada ao final.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-09 · Check-in manual longe do hospital

- **Pré-condição:** a mais de 1 km do hospital.
- **Passos:** fazer check-in manual no hospital e avaliar depois.
- **Esperado:** a avaliação aparece no Histórico, mas **não muda a nota pública** do hospital.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-10 · GPS desligado durante a visita

- **Pré-condição:** visita automática ativa.
- **Passos:** desligar a localização do aparelho por ~5 min; religar.
- **Esperado:** o app não trava nem fecha a visita antes de 45 min sem sinal (RN-06); ao religar, o acompanhamento volta sozinho.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-11 · Recusa da permissão "o tempo todo"

- **Pré-condição:** instalação limpa ou permissão revogada.
- **Passos:** abrir o app e ler o aviso antes do pedido; recusar.
- **Esperado:** o aviso explica o uso da localização com o app fechado e que não serve para publicidade; após a recusa o app não insiste por 3 dias.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

---

## 3. GPS e rede sem internet

> Para "sem internet" desligar **dados móveis e Wi-Fi** (não só o modo avião, pois ele também desliga o GPS em alguns aparelhos). Wi-Fi de hospital que exige login conta como **sem internet**.

### TC-12 · Entrada **sem** internet (visita provisória, M-070)

- **Pré-condição:** logado; sem internet antes de chegar; app fechado.
- **Passos:** entrar no hospital sem internet, ficar ~5 min, sair, e só então religar a internet. Anotar horas: entrada ______ saída ______ internet de volta ______
- **Esperado:** depois de religar, o Histórico mostra a visita com **entrada e saída reais**, `Finalizada`.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-13 · Entrada com internet, saída sem internet (caso Ceilândia 23/10)

- **Pré-condição:** entrar com internet e ver o check-in feito.
- **Passos:** desligar a internet, sair do hospital, ficar **mais de 45 min** sem internet (tempo do job de GPS interrompido); religar sem abrir o app e esperar ~5 min; abrir o Histórico.
- **Esperado:** visita `Finalizada` com a permanência real (da entrada à saída), **não** `GPS interrompido` com 0 min; o convite de avaliação aparece e o envio funciona (RN-06, M-068).
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Duração no Histórico: ______ · Anotações: ____________________

### TC-14 · Saída com sinal fraco

- **Pré-condição:** visita ativa.
- **Passos:** sair por um ponto de sinal ruim, com internet ligada (sem forçar modo avião); ir a um lugar de sinal bom, sem abrir o app.
- **Esperado:** a visita vira `Finalizada` com a permanência real, mesmo sem abrir o app.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-15 · Catálogo e lista sem internet

- **Pré-condição:** o app já foi aberto com internet ao menos uma vez (catálogo baixado).
- **Passos:** ligar o modo avião; abrir a aba Hospitais e depois a aba Mapa. Buscar "agua" (sem acento) e filtrar por tipo.
- **Esperado:** a lista aparece na hora, sem nota, com o aviso "Sem conexão com o servidor"; o mapa mostra os marcadores; busca e filtro funcionam. Com internet de volta, as notas reaparecem.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-16 · Abrir o app já sem internet, depois de reinício do aparelho

- **Pré-condição:** catálogo baixado antes; internet desligada.
- **Passos:** reiniciar o aparelho; sem abrir o app, andar até um hospital e entrar; abrir o app depois.
- **Esperado:** o geofencing continua valendo (a cópia local do catálogo é usada); a entrada é registrada e vai para a fila.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-17 · Sessão expirada em campo

- **Pré-condição:** logado há mais de 15 min.
- **Passos:** abrir o Histórico e um hospital com o token vencido.
- **Esperado:** a sessão renova sozinha, sem voltar ao login.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

---

## 4. Fila offline (app aberto)

### TC-18 · Ações guardadas e enviadas ao voltar a internet

- **Pré-condição:** logado; internet desligada; visita em andamento (manual ou automática).
- **Passos:** fazer check-in/saída manual sem internet; fechar o app; religar a internet e abrir o app.
- **Esperado:** nenhuma ação é perdida; check-in e checkout seguem a ordem correta (entrada antes da saída), sem duplicar visita no Histórico.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-19 · Limites da fila

- **Pré-condição:** internet desligada por um longo período (ex.: um dia).
- **Passos:** manter itens na fila por mais de 24 h e depois religar (só se der para esperar; senão N/A).
- **Esperado:** itens com mais de 24 h são descartados e o app não trava nem repete envio.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

---

## 5. Avaliações e notificações

### TC-20 · Convite de avaliação depois da saída (RN-08)

- **Pré-condição:** visita de 2 min ou mais, finalizada.
- **Passos:** sair; contar 1 min; tocar na notificação.
- **Esperado:** chega cerca de 1 min após a saída (nunca dentro da área hospitalar) e abre a tela certa de avaliação.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Hora da saída: ______ Hora da notificação: ______

### TC-21 · Visita menor que 2 min não gera convite

- **Passos:** fazer uma visita manual de menos de 2 min.
- **Esperado:** nenhuma notificação de avaliação.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-22 · Avaliação pendente por 24h (M-029, RN-09)

- **Pré-condição:** visita finalizada; notificação **ignorada**.
- **Passos:** abrir a Home sem tocar na notificação; ver o card "Avaliação pendente"; tocar em "Agora não"; reabrir mais tarde.
- **Esperado:** o card mostra hospital e prazo ("Responda até hoje às HH:MM"); "Avaliar" abre o formulário; some depois de avaliar; chega **um** lembrete cerca de 6 h depois; depois das 24 h o card some e não há mais lembrete.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-23 · Duas visitas no mesmo dia

- **Passos:** fazer duas visitas (hospitais diferentes) e não avaliar nenhuma.
- **Esperado:** duas pendências na Home; avaliar uma não apaga a outra.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-24 · Avaliar visita encerrada como GPS interrompido

- **Pré-condição:** uma visita que o job encerrou como `GPS_INTERROMPIDO` (ex.: TC-10 estendido, ou celular sem bateria dentro do hospital).
- **Passos:** abrir o app depois e avaliar.
- **Esperado:** a visita aparece como pendente e aceita avaliação dentro das 24 h.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-25 · Editar a avaliação em até 15 dias (M-063)

- **Pré-condição:** logado; avaliação feita há menos de 15 dias.
- **Passos:** Histórico > aba Avaliações; tocar em Editar; mudar a nota e salvar; editar de novo.
- **Esperado:** o card mostra o nome do hospital, a data e "Pode editar até dd/mm/aaaa"; o formulário abre com as respostas gravadas; "Avaliação atualizada!"; a segunda edição também funciona; em até ~20 min a nota do hospital reflete a mudança (se a visita tem prova de presença). Avaliação com mais de 15 dias não mostra o botão. Avaliação anônima (sem login) não é editável.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-26 · Nota pública só com presença

- **Passos:** comparar a nota de um hospital antes e depois de uma avaliação de visita **dentro** do hospital (deve mudar em até 5 min) e de outra feita com check-in manual **longe** (não deve mudar).
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Nota antes/depois: ______ / ______

---

## 6. Fila enviada com o app fechado (PR #255, M-075)

> **Só executar com um APK que contenha o #255.** Sem ele, marcar N/A.

### TC-27 · Saída sem internet, app fechado, rede volta longe do hospital

- **Pré-condição:** logado; entrada feita com internet; app fechado.
- **Passos:**
  1. Desligar a internet e sair do hospital. Anotar saída: ______
  2. Fechar o app pela lista de recentes.
  3. Afastar-se, para **não** passar perto de outro hospital monitorado. Religar a internet. Anotar: ______
  4. **Não abrir o app.** Esperar de 15 a 30 min (o Android pode atrasar para poupar bateria).
  5. Abrir o Histórico.
- **Esperado:** a visita está `Finalizada` com o horário **real** da saída; o checkout saiu sem o app ser aberto.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Hora em que fechou (se souber): ______ · Anotações: ____________________

### TC-28 · Fila vazia não gasta bateria nem rede

- **Passos:** com o app instalado e a fila vazia, usar o aparelho normalmente por algumas horas e conferir o consumo do app em Bateria.
- **Esperado:** consumo desprezível; nenhum erro novo no Sentry (`fila.segundoPlano`, `fila.registroSegundoPlano`).
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Consumo: ______ · Anotações: ____________________

---

## 7. Mapa (MapLibre, M-071)

### TC-29 · Mapa e marcadores

- **Pré-condição:** GPS ligado, com internet.
- **Passos:** abrir a aba Mapa; arrastar e dar zoom; tocar num marcador; tocar num geofence com hospitais sobrepostos.
- **Esperado:** ruas e nomes aparecem e a atribuição do OpenStreetMap fica visível; ~340 marcadores sem travar; o card mostra nota, tempo e distância; a lista de hospitais do ponto abre na sobreposição; o mapa **não volta sozinho** à posição do GPS depois de mexer nele.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-30 · Filtro de distância

- **Passos:** trocar entre 1, 5, 10 e 25 km e "Todos".
- **Esperado:** o mapa reenquadra a cada troca; com 1 km e um só hospital não vai ao zoom máximo e nunca fica cinza (M-064); marcadores de fora somem na hora.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-31 · Mapa sem internet

- **Passos:** modo avião, abrir o Mapa.
- **Esperado:** os marcadores aparecem; o card fica sem nota. O fundo do mapa (tiles) pode não carregar fora do que está em cache: anotar o que se vê.
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

### TC-32 · Detalhe do hospital e volta

- **Passos:** abrir o Detalhe do Hospital e voltar ao Mapa.
- **Esperado:** o detalhe centraliza no hospital com o círculo do geofence; o mapa principal continua funcionando (M-014).
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

---

## 8. Identidade e conta (rc.15)

### TC-33 · Nome Pulseira Verde

- **Passos:** conferir o ícone (deve ser "Pulseira Verde HML"), a tela de login, "Esqueci minha senha", Política de Privacidade, Perfil e o título da notificação de visita.
- **Esperado:** nenhuma menção a "Radar Saúde" nem a "Clinical Sanctuary".
- **Resultado:** ☐ OK ☐ FALHOU ☐ N/A · Anotações: ____________________

---

## 9. Fechamento da saída de campo

### 9.1 Defeitos encontrados

| # | Teste | O que aconteceu | Hora | Print/Sentry |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### 9.2 Resumo

| Bloco | Testes | OK | FALHOU | N/A |
|---|---|---|---|---|
| 1 Check-in e saída | TC-01 a 07 | | | |
| 2 GPS e check-in manual | TC-08 a 11 | | | |
| 3 Sem internet | TC-12 a 17 | | | |
| 4 Fila offline | TC-18 a 19 | | | |
| 5 Avaliações e notificações | TC-20 a 26 | | | |
| 6 Fila com app fechado (#255) | TC-27 a 28 | | | |
| 7 Mapa | TC-29 a 32 | | | |
| 8 Identidade | TC-33 | | | |

- Data e local: ______________________ · Aparelho/Android: ______________________ · APK: ______________
- Conclusão (aprova, aprova com ressalvas, reprova): ______________________
- Os resultados vão para a seção 4 do registro da rc testada em [`homologacoes/`](./homologacoes/).
