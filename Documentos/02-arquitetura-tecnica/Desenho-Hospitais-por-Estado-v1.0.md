# Desenho — Hospitais por estado (UF) para o lançamento nacional

> **Versão:** 1.0 · **Data:** 13/11/2026 · **Status:** 🟡 Proposta (aguarda as decisões da §9)
> **Base de código:** `develop` em `472c208` (merge do PR #260)
> **Base de dados medida:** arquivo público `cnes_estabelecimentos.zip` do DATASUS
> (`s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/CNES/`, publicado em 11/06/2025, 574.006 linhas).
> É o retrato mais recente que o ambiente conseguiu baixar; serve para ordem de grandeza, não para a carga.
> **Sem código neste documento.** ADR correspondente: ADR-017 (proposto) em `08-analise tecnica/adrs.md`.

---

## 1. O pedido e o porquê

O PO perguntou se o app teria acesso a todos os estabelecimentos de saúde do país. A fonte é o
CNES/DATASUS, que publica dados abertos todo mês. A ideia: a pessoa da Bahia vê os hospitais da
Bahia e a do DF vê os do DF, e o app é liberado estado a estado, começando pelo DF.

Este documento responde três perguntas:

1. **Quanto dado é isso de verdade?** (§3, medido)
2. **Onde a regra "um estado por vez" mora** no backend, no app e no painel, sem quebrar o que já
   funciona (catálogo local por versão, geofencing, fila offline). (§4 a §7)
3. **O que o PO precisa decidir antes de escrever código**, e em que ordem entregar. (§9 e §10)

### Objetivos

- Cada pessoa vê, por padrão, os estabelecimentos do estado em que está, e pode trocar o estado à mão.
- O time libera um estado por vez, sem versão nova do app.
- A visita automática continua valendo pela posição real, mesmo fora do estado escolhido.
- O tamanho do que o app baixa e guarda fica sob controle em qualquer estado.

### Fora de escopo (não-objetivos)

- Estabelecimentos privados e filantrópicos. A base hoje é só pública, por decisão do PO de 09/09/2026
  (`07-dados/relatorio-importacao-CNES_PUBLICOS_COMPLEMENTARES_20260909.md`). Os números da §3
  já seguem esse corte. Se mudar, é a decisão D2.
- Bloquear o uso fora do estado. A UF escolhe o que aparece; não é cerca.
- Geocodificar endereços com serviço pago (ver §4.4: o problema é de 23 registros).

### O que seria fracasso mesmo funcionando

- Quem mora no DF e é atendido no Entorno (Valparaíso, Águas Lindas, Luziânia, todos em GO) perder a
  visita automática por causa da divisa.
- O app de São Paulo travar ao abrir porque o catálogo não cabe onde ele é guardado hoje (§3.2).
- APKs já instalados (testadores da rc) passarem a ver o Brasil inteiro, ou nada, no dia em que o
  backend mudar.

---

## 2. Como funciona hoje (medido no código)

| Peça | Hoje | Arquivo |
|---|---|---|
| Base | 341 estabelecimentos públicos do DF, vindos do InfoSaúde/GDF (DBF/SHP) e complementados pelo CNES | `hospital/seed/SeedRunner.java`, `SeedMapper.java` (`uf("DF")` fixo) |
| UF no documento | Existe em `endereco.uf`, **sem índice** | `hospital/document/EnderecoDocument.java` |
| Importador CNES | Existe, desligado por padrão, lê um arquivo, faz upsert por `codigoCnes`, gera geofence circular, tem `ufPadrao` | `hospital/migration/ImportadorEstabelecimentos.java`, `ImportacaoProperties.java` |
| Catálogo público | `GET /api/v1/catalogo` devolve **todos** os ativos; versão = SHA-256 do conteúdo; cache de 5 min por instância; `ETag` fraco | `CatalogoService.java`, `CatalogoController.java` |
| Indicadores | `GET /api/v1/catalogo/indicadores`, todos os ativos | idem |
| Versão no app | `versaoCatalogo` único na configuração remota | `configuracao/dto/ConfiguracaoRemotaResponse.java` |
| Ranking | Carrega **todos** os ativos em memória e ordena a cada pedido | `HospitalServiceImpl#ranking` |
| Check-in | `$geoIntersects` contra todos os geofences ativos, **sem olhar UF** | `VisitaServiceImpl` linha ~439 |
| Catálogo no app | Uma chave do AsyncStorage (`@saude_monitor:catalogo`) com o catálogo inteiro | `frontend/src/services/CatalogoLocal.js` |
| Geofencing | Pega do catálogo local os 19 mais próximos num raio de 5 km e registra no sistema | `GeofencingTaskService.js` (`MAX_REGIOES_HOSPITAIS = 19`, `RAIO_BUSCA_HOSPITAIS_METROS = 5000`) |
| Mapa | MapLibre + OpenFreeMap; marcadores sem agrupamento (sem *cluster*) | `utils/mapkit` |
| Painel | Filtro por Região Administrativa (só existe no DF) | `AdminHospitalController.java` |

Duas consequências diretas:

- **O check-in já funciona em qualquer estado.** Nada no backend precisa mudar para a visita fora da
  UF escolhida; só o app precisa ter o hospital no catálogo local para registrar o geofence.
- **Catálogo, indicadores e ranking não escalam para o país** do jeito que estão: os três leem
  todos os ativos.

---

## 3. Tamanho real da base

### 3.1 Contagem por UF (CNES, só públicos, só ativos)

Filtros aplicados: `CO_MOTIVO_DESAB` vazio (ativo), `CO_NATUREZA_JUR` começando por `1`
(administração pública), e os tipos de unidade (`TP_UNIDADE`) que o app já trata:
hospital (5, 7, 15, 62), urgência/UPA/pronto-socorro (73, 20, 21), UBS/posto (1, 2), policlínica (4)
e CAPS (70). Tamanho em JSON = itens × 463 bytes, medido montando o `HospitalResumoResponse` de
amostras reais de BA, SP, MG, GO e DF (460 a 470 bytes por item; gzip reduz a ~10%).

| UF | Hospitais | Urgência | UBS | Polic.+CAPS | **Escopo atual** | JSON | Só hosp.+urg. | JSON | Sem coord. | Ponto repetido |
|---|---|---|---|---|---|---|---|---|---|---|
| AC | 26 | 4 | 248 | 18 | **296** | 134 KB | 30 | 14 KB | 0 | 10 |
| AL | 52 | 28 | 1.087 | 126 | **1.293** | 585 KB | 80 | 36 KB | 0 | 92 |
| AM | 95 | 12 | 735 | 65 | **907** | 410 KB | 107 | 48 KB | 0 | 24 |
| AP | 18 | 5 | 217 | 12 | **252** | 114 KB | 23 | 10 KB | 2 | 7 |
| BA | 371 | 121 | 4.936 | 454 | **5.882** | 2,6 MB | 492 | 222 KB | 2 | 440 |
| CE | 180 | 108 | 2.684 | 248 | **3.220** | 1,4 MB | 288 | 130 KB | 1 | 140 |
| DF | 19 | 13 | 181 | 44 | **257** | 116 KB | 32 | 14 KB | 0 | 4 |
| ES | 39 | 46 | 936 | 94 | **1.115** | 504 KB | 85 | 38 KB | 0 | 37 |
| GO | 224 | 58 | 1.507 | 158 | **1.947** | 880 KB | 282 | 128 KB | 0 | 46 |
| MA | 259 | 26 | 2.547 | 149 | **2.981** | 1,3 MB | 285 | 129 KB | 0 | 250 |
| MG | 187 | 146 | 6.159 | 728 | **7.220** | 3,2 MB | 333 | 151 KB | 2 | 252 |
| MS | 45 | 26 | 663 | 67 | **801** | 362 KB | 71 | 32 KB | 0 | 29 |
| MT | 87 | 55 | 1.062 | 72 | **1.276** | 577 KB | 142 | 64 KB | 0 | 47 |
| PA | 162 | 44 | 2.410 | 138 | **2.754** | 1,2 MB | 206 | 93 KB | 3 | 93 |
| PB | 124 | 31 | 1.804 | 237 | **2.196** | 993 KB | 155 | 70 KB | 0 | 118 |
| PE | 231 | 46 | 2.960 | 261 | **3.498** | 1,5 MB | 277 | 125 KB | 0 | 205 |
| PI | 143 | 9 | 1.637 | 83 | **1.872** | 846 KB | 152 | 69 KB | 2 | 131 |
| PR | 155 | 130 | 2.723 | 240 | **3.248** | 1,4 MB | 285 | 129 KB | 3 | 98 |
| RJ | 196 | 149 | 2.125 | 384 | **2.854** | 1,3 MB | 345 | 156 KB | 1 | 118 |
| RN | 152 | 25 | 1.327 | 81 | **1.585** | 717 KB | 177 | 80 KB | 0 | 74 |
| RO | 62 | 12 | 350 | 28 | **452** | 204 KB | 74 | 33 KB | 0 | 20 |
| RR | 17 | 1 | 165 | 12 | **195** | 88 KB | 18 | 8 KB | 1 | 17 |
| RS | 37 | 98 | 2.610 | 423 | **3.168** | 1,4 MB | 135 | 61 KB | 2 | 87 |
| SC | 43 | 64 | 1.932 | 214 | **2.253** | 1019 KB | 107 | 48 KB | 1 | 68 |
| SE | 20 | 21 | 773 | 47 | **861** | 389 KB | 41 | 19 KB | 0 | 52 |
| SP | 273 | 442 | 5.448 | 982 | **7.145** | 3,2 MB | 715 | 323 KB | 3 | 248 |
| TO | 48 | 17 | 463 | 30 | **558** | 252 KB | 65 | 29 KB | 0 | 26 |
| **BR** | **3.265** | **1.737** | **49.689** | **5.395** | **60.086** | **26,5 MB** | **5.002** | **2,2 MB** | **23** | **2.733** |

Para comparar: o CNES inteiro tem 574.006 linhas, 457.334 ativas, e 115 mil de natureza pública.
"Ponto repetido" = unidade com a mesma coordenada (4 casas, ~11 m) de outra unidade do mesmo estado.

**Leituras:**

- **UBS são 83% do escopo.** A decisão de incluir ou não UBS (D1) muda o tamanho em 12 vezes.
- **DF no CNES tem 257, a nossa base tem 341.** A base do DF veio do InfoSaúde, que tem camadas que
  o CNES não cobre do mesmo jeito (população de rua, indígena, prisional). O DF não deve ser
  substituído pelo CNES; o importador só complementa o DF.
- **Coordenada faltando é quase inexistente** (23 no país). Coordenada **ruim** é o problema real:
  2.733 unidades dividem o ponto com outra, o que costuma indicar centroide do município ou do bairro
  digitado no lugar do endereço. Com geofence de 150 m, pontos repetidos viram conflito de check-in
  (RN-05, "Escolha o hospital").

### 3.2 O limite que muda o desenho no app

O catálogo hoje é **uma** chave do AsyncStorage 2.2.0. No Android ele é guardado em SQLite, e uma
linha acima de ~2 MB não volta na leitura (`CursorWindow`), além do teto padrão de 6 MB do banco
inteiro. SP (3,2 MB), MG (3,2 MB) e BA (2,6 MB) passam disso com UBS; o Brasil inteiro (26,5 MB)
passa de tudo. **A verificar no aparelho antes de decidir**, mas o risco é concreto o bastante para
o desenho tratar: o catálogo sai do AsyncStorage e vai para arquivo (`expo-file-system`, que o app
já tem), um arquivo por UF.

### 3.3 O banco

Cada documento de `hospitais` leva o polígono do geofence (33 vértices) e fica na casa de 2 KB.
60 mil documentos ≈ 120 MB com índices; 5 mil ≈ 10 MB. O Atlas M0 (512 MB, compartilhado com o dev,
ADR-015) aguenta os dois, mas o escopo com UBS consome uma fatia relevante dele.

---

## 4. Backend

### 4.1 Filtro por UF

- **Índice** composto `{ ativo: 1, 'endereco.uf': 1 }` em `hospitais`.
- `GET /api/v1/catalogo?uf=BA` e `GET /api/v1/catalogo/indicadores?uf=BA`: o `CatalogoService` passa a
  guardar um catálogo por UF (mapa de no máximo 27 entradas, mesma validade de 5 min). A versão é o
  SHA-256 do conteúdo daquela UF, como hoje. A URL com `uf` continua cacheável na borda (ADR-016).
- **Compatibilidade com APKs instalados:** sem `uf`, as duas rotas devolvem **só o DF**, exatamente o
  que esses APKs mostram hoje. Nunca o Brasil inteiro.
- `uf` validado contra a lista fixa das 27 siglas (400 se inválida). UF válida mas não liberada:
  404 com código próprio (`UF_NAO_LIBERADA`), para o app mostrar a tela da §5.4.
- `GET /api/v1/hospitais/ranking?uf=` passa a filtrar por UF antes de ordenar. Sem `uf`, DF (mesma
  regra de compatibilidade). Hoje ele lê todos os ativos a cada pedido; nacional, isso não pode ficar.
- `GET /api/v1/hospitais` (busca por raio) não precisa de parâmetro `uf`: a consulta geográfica já
  recorta. Mas ela, o detalhe e o ranking precisam ignorar estabelecimentos de UF não liberada
  (§4.2), senão um hospital importado e ainda em revisão aparece na busca por raio perto da divisa.
- **Check-in, checkout, sinal da visita: sem mudança.** Continuam por `$geoIntersects` em qualquer UF.

### 4.2 Liberação estado a estado

- Configuração remota ganha `ufsLiberadas: ["DF"]` e `versoesCatalogo: { "DF": "…" }` (só das
  liberadas). `versaoCatalogo` continua existindo com a versão do DF, para os APKs antigos.
- Quem liga e desliga é o ADMIN pelo painel (§6). Ligar uma UF não exige deploy nem APK novo.
- Estabelecimentos de UF não liberada podem estar no banco (importados, em revisão) e não aparecem em
  nenhuma rota pública, **exceto o check-in**: se alguém fizer visita num hospital de UF ainda
  fechada, ela não registra porque o app não tem o geofence. Isso é aceitável e vira D5.

### 4.3 Importação do CNES por estado

O importador atual serve de base; muda o que ele lê e quando roda.

- **Formato:** o CSV nacional do DATASUS (separador `;`, Latin-1), lendo `CO_UF`, `TP_UNIDADE`,
  `CO_NATUREZA_JUR`, `CO_MOTIVO_DESAB`, `NU_LATITUDE`, `NU_LONGITUDE`, endereço e município
  (`CO_IBGE` → nome pela tabela do IBGE). Mapeamento `TP_UNIDADE` → `CategoriaEstabelecimento` em
  `CategoriaMapper`.
- **Quando roda:** fora do startup. Hoje as tarefas de inicialização já atrasaram o deploy (M-066).
  Proposta: um Cloud Run Job (ou rota ADMIN protegida) com parâmetro `uf`, sob a `TravaDistribuida`.
- **Chave:** `codigoCnes` (upsert, índice único já existe). `fonte = IMPORTACAO`.
- **Atualização mensal:** o CNES sai todo mês. Reimportar a UF: unidade com `CO_MOTIVO_DESAB`
  preenchido vira `ativo = false` (nunca apagar, as visitas e avaliações apontam para ela).
  Registro com `fonte = CADASTRO` ou editado no painel não é sobrescrito nos campos que o ADMIN mexeu
  (nome, posição, raio); a importação só preenche o que estiver vazio.
- **DF:** a importação só acrescenta CNES que a base não tem; não toca nos 341 atuais.
- **Relatório por UF** em `07-dados/relatorio-importacao-CNES_<UF>_<data>.md`, como os anteriores.

### 4.4 Coordenadas e duplicados

- **Sem coordenada (23 no país):** não importar; listar no relatório para o ADMIN cadastrar à mão
  ou pela fila de sugestões. Não vale contratar geocodificador para 23 registros.
- **Coordenada suspeita:** no relatório, marcar (a) ponto repetido em 3 ou mais unidades, (b) ponto
  fora do polígono da própria UF. A UF só é liberada com essa lista revisada (critério da §10).
- **Duplicado:** `codigoCnes` único resolve entre importações. Contra a base do DF, o cruzamento por
  nome e distância do relatório de 09/09/2026 é o modelo.
- **Região Administrativa:** só existe no DF. Fora dele, o painel filtra por município (`endereco.cidade`).

---

## 5. App

### 5.1 Qual é o estado da pessoa

- **Na primeira abertura**, o app descobre a UF pela posição **no próprio aparelho**, com o contorno
  das 27 UFs (malha simplificada do IBGE, domínio público, na casa de 100 a 200 KB) e um teste de
  ponto no polígono. Funciona sem rede e a coordenada não sai do aparelho.
  Alternativa mais barata de construir: `Location.reverseGeocodeAsync` do expo-location, que já
  está instalado; depende de rede e manda a posição ao serviço do sistema (Google, no Android).
  Recomendo a malha, pelos dois motivos; vira D4.
- Sem permissão de localização: a pessoa escolhe o estado numa lista.
- A UF escolhida fica guardada **só no aparelho** e pode ser trocada em Perfil.
- Se a posição atual for de outra UF liberada, o app oferece uma vez: "Você está em Goiás. Ver os
  hospitais de Goiás?". Não troca sozinho.

### 5.2 Catálogo por UF

- `CatalogoLocal` passa a guardar **um arquivo por UF** (`expo-file-system`), com a mesma lógica de
  hoje: versão vinda da configuração remota, `If-None-Match`, idade máxima de um dia, cópia velha
  vale sem rede.
- O app guarda no máximo: a UF escolhida + a UF onde a pessoa está + a vizinha quando ela estiver a
  menos de 5 km da divisa (a mesma malha da §5.1 dá a distância). As outras são apagadas.
- Migração: na primeira abertura da versão nova, a chave antiga do AsyncStorage vira o arquivo do DF
  e é apagada.

### 5.3 Geofencing e visita fora do estado

- O recálculo dos 19 geofences mais próximos passa a usar **a união dos catálogos guardados**,
  não só o da UF escolhida. É isso que garante a visita no Entorno para quem escolheu DF.
- Viagem para uma UF cujo catálogo ainda não foi baixado: sem geofence até haver rede para baixar.
  Com rede, o recálculo em segundo plano baixa a UF nova (um pedido por troca de estado, não por
  deslocamento). Aceitável; o check-in manual continua possível na tela do hospital.
- Fila offline (M-068, M-070, M-075): sem mudança, porque a visita é identificada pelo hospital, não
  pela UF.

### 5.4 Telas

- **Hospitais e Mapa:** mostram a UF escolhida, com o nome dela no topo e o atalho para trocar.
  O mapa abre enquadrado na UF.
- **Mapa:** com milhares de pontos (SP e MG com UBS passam de 7 mil), os marcadores precisam de
  agrupamento (`cluster` da fonte GeoJSON do MapLibre). Sem isso o mapa fica ilegível e pesado.
  Com o escopo só de hospitais e urgência, o maior estado tem 715 pontos e dá para adiar.
- **Ranking:** da UF escolhida.
- **UF não liberada:** tela "O Pulseira Verde ainda não chegou em <estado>", com a lista das UFs
  liberadas. Sem cadastro de "avise-me" nesta versão.

---

## 6. Painel admin

- Filtro por UF na lista de hospitais e no mapa (o Leaflet abre enquadrado na UF); Região
  Administrativa só aparece com DF selecionado; fora do DF, filtro por município.
- Tela de liberação: as 27 UFs com quantidade de estabelecimentos, data da última importação, número
  de pontos suspeitos e o botão liberar/recolher (grava `ufsLiberadas`).
- Indicadores do painel (dashboard) filtrados por UF.
- Sugestões de hospital já trazem UF no endereço; ganham o filtro.

---

## 7. Escala, custo e LGPD

### 7.1 Plano de escala (ADR-015, ADR-016)

- O ADR-015 foi dimensionado para a população do DF. O país muda a premissa de usuários, mas **não**
  muda a forma: catálogo e indicadores continuam públicos e cacheáveis na borda, agora um por UF.
  O que deixa de escalar é o ranking em memória, que a §4.1 corrige.
- O dimensionamento nacional fica para depois da primeira UF fora do DF, com uso medido. As decisões
  D1–D5 do ADR-015 e P1–P15 da análise de escala continuam em espera; este desenho não depende delas.

### 7.2 LGPD

- A UF é descoberta no aparelho e fica no aparelho. O servidor só recebe `?uf=BA` no pedido do
  catálogo, igual para todo mundo daquele estado, e não grava isso por pessoa.
- A política de privacidade (`site/`, versão 1.2) precisa de uma linha: a localização também é
  usada, no aparelho, para escolher o estado. Se a D4 for o `reverseGeocodeAsync`, a linha precisa
  dizer que a posição vai ao serviço de geocodificação do sistema.
- Dados do CNES são públicos e de estabelecimentos, não de pessoas. O e-mail e o telefone do CNES
  não entram no catálogo público (o `HospitalResumoResponse` já não leva contato).

---

## 8. Caminhos considerados

| Caminho | Como | Prós | Contras | Veredito |
|---|---|---|---|---|
| **A. Catálogo por UF** | Servidor filtra por `uf`; app guarda as UFs que importam | Tamanho sob controle em qualquer escopo; liberação UF a UF natural; cache na borda por URL | Mais peças no app (escolha de UF, vários arquivos, união no geofencing) | **Recomendado** |
| B. Catálogo nacional único, filtro só na tela | Um arquivo com o país; a tela filtra por UF | O mais simples; geofence nunca falha na divisa | Só cabe se o escopo for hospitais + urgência (2,2 MB, já no limite da §3.2); com UBS são 26,5 MB; a liberação UF a UF vira só `ativo` | Vale **só** se D1 = sem UBS e D3 = não precisa liberar por UF |
| C. Catálogo por proximidade | Servidor responde pelo raio da posição | Pouco dado no aparelho | Volta o problema que o ARQ-01 resolveu: um pedido por deslocamento, sem cache, com a posição exata indo ao servidor | Descartado |

---

## 9. Decisões abertas para o PO

Em ordem do que mais muda o trabalho:

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| **D1** | Quais tipos entram fora do DF? | (a) só hospitais e urgência/UPA: 5 mil no país; (b) + UBS, policlínicas e CAPS, como no DF: 60 mil | **(a) no lançamento**, UBS por estado depois. 12 vezes menos dado, mapa sem agrupamento, revisão de coordenadas viável à mão |
| **D2** | Privados e filantrópicos continuam fora? | Sim / não | Sim, como decidido em 09/09; a contagem muda se entrarem |
| **D3** | Por que liberar estado a estado: tamanho do dado, qualidade da base, parcerias com o poder público, ou foco de divulgação? | — | A resposta escolhe entre os caminhos A e B da §8 |
| **D4** | Como descobrir a UF | malha do IBGE no app / `reverseGeocodeAsync` | Malha no app (offline e sem mandar posição) |
| **D5** | Visita em UF ainda não liberada | não registra / registra sem mostrar o hospital | Não registra no lançamento |
| **D6** | Segunda UF depois do DF | GO / outra | **GO**: o Entorno é onde o morador do DF já é atendido, e testa a divisa logo |
| **D7** | A UF escolhida vai para a conta? | só no aparelho / também na conta | Só no aparelho (menos dado pessoal; troca de aparelho só pergunta de novo) |

---

## 10. Fases e esforço

Estimativas em dias de desenvolvimento, com testes e Sonar, para o escopo recomendado (D1 = a).
Com UBS, somar ~3 dias (agrupamento no mapa, revisão de coordenadas maior).

| Fase | Entrega | Áreas | Esforço |
|---|---|---|---|
| 0 | Respostas D1–D7; teste no aparelho do limite da §3.2 com um catálogo de 3 MB | — | — |
| 1 | `uf` em catálogo, indicadores e ranking; índice; `ufsLiberadas` e `versoesCatalogo`; DF como padrão sem `uf` | backend | 3 |
| 2 | Importador do CSV nacional por UF, fora do startup; relatório com pontos suspeitos; atualização mensal | backend, docs | 4 |
| 3 | UF no app (malha IBGE, escolha, troca); catálogo em arquivo por UF; união no geofencing; tela de UF não liberada; ranking por UF | app | 6 a 8 |
| 4 | Painel: filtro por UF/município, tela de liberação, dashboard por UF | admin | 3 |
| 5 | Importar GO, revisar pontos suspeitos, liberar GO na homologação e testar a divisa DF/GO em campo | dados, homologação | 2 + campo |

Total: **18 a 20 dias** de desenvolvimento até a segunda UF. Cada UF seguinte custa a importação e
a revisão dos pontos suspeitos (de meio dia a 2 dias, conforme o tamanho).

**Critério para liberar uma UF:** importação sem erro, relatório publicado, pontos suspeitos
revisados, check-in testado em pelo menos um hospital da UF.

---

## 11. O que fica para quem implementar

- Nome exato das rotas e dos campos novos, desde que mantenham a compatibilidade da §4.1.
- Formato da malha do IBGE no app (GeoJSON simplificado ou outro), desde que caiba em ~200 KB.
- Se a liberação mora na coleção da configuração remota ou numa coleção própria.
- O teste do limite do AsyncStorage pode mostrar que dá para manter a chave única no escopo (a);
  o arquivo por UF continua sendo o caminho se UBS entrar.
