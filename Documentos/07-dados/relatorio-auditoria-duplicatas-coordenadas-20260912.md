# Auditoria — unidades duplicadas e coordenadas suspeitas (12/09/2026)

> **Origem:** relato do PO com evidência em aparelho — "vários círculos amontoados" em São Sebastião (UPA + UBSs + Casa de Parto) + pedido de validação de endereços/lat/lon.
> **Método (Zero-Trust):** catálogo completo do backend de dev (`GET /api/v1/hospitais` paginado, 340 docs, 12/09/2026) cruzado com os arquivos-fonte do seed (`backend/data/*.shp/.dbf`, exportação de 25/08/2026) via `mapshaper`. Nenhuma afirmação abaixo é visual — todas têm contagem.
> **Escopo do dado:** banco de **dev**. Nenhuma deleção foi executada (sem acesso ao Atlas por aqui + ação destrutiva exige decisão do PO com backup).

## 1. Veredito em uma tabela

| # | Achado | Medição | Classificação | Ação |
|---|---|---|---|---|
| DUP-01 | 10 grupos de mesmo nome, 23 docs (ex.: "Ubs São Sebastião" ×5, "Ubs 2 - Asa Norte" ×3) | pares versão COM CNES × versão sem CNES da camada Indígena/Rua (coords ~20 m apart); 5 Papuda sem CNES com nome sintético | **Duplicação intra-seed, mesma execução (26/08 19:08)**: camadas sem coluna CNES repetem unidades da principal e o upsert (por CNES *ou* `importKey` com coords) não as casa — ver §2 | Correção no seed (entregue, §5) + limpeza dos 23 existentes (§4) |
| DUP-02 | 7 pares de coords exatas, nomes diferentes | 5× Cepav dividindo o ponto do hospital/UBS que as abriga (mesmo endereço/CEP) → **co-localização legítima** | Manter | Mapa precisa de desambiguação (BUG-11, entregue) |
| DUP-03 | `Ubs 01 Riacho Fundo I` × `Ubs 03 Riacho Fundo Ii` — **mesma coordenada, endereços diferentes** (Qn 09 × Qn 07) | 1 par | **Coordenada errada em pelo menos um dos dois** (não há como dois endereços distintos ocuparem o mesmo ponto) | Correção manual (não automatizável — §4) |
| DUP-04 | 77 pares < 50 m não-exatos (CAPS+UBS, UPA+laboratório…) | endereços do mesmo complexo assistencial | Vizinhança real | Desambiguação de toque (BUG-11) |

## 2. Evidência central (DUP-01) — corrigida após acesso ao banco

> ⚠️ **Correção de diagnóstico (ainda em 12/09):** a primeira versão desta seção afirmava
> "órfãos de re-seeds com versões diferentes dos arquivos". Falso — medição direta no
> Mongo (`saude_monitor_dev`, coleção `hospitais`) mostra os 23 docs criados na **mesma
> execução** (26/08 19:08:48–19:09:03), cada grupo com **1 doc COM CNES + 1+ docs sem
> CNES** (só importKey), todos `fonte: DBF_SHP_SEED`. O mecanismo real está abaixo; a
> hipótese anterior foi descartada por evidência, não por opinião.

Cada grupo tem a variante **com-CNEs (coordenada precisa)** × **sem-CNEs (coordenada arredondada)**:

- `Ubs 1 - Asa Sul`: `-15.83276899968653` (CNES `0011150`) × `-15.8328` (só importKey, 6 s antes)
- `Ubs 2 - Asa Norte` ×3 (1 com CNES `0010723` + 2 só importKey) · `Ubs 1 - Paranoa/Paranoá` · `Ubs 1 - Sobradinho` · `Ubs 2 - Itapoa` · `Ubs 4 - Gama` · `Ubs 5 - Ceilândia` · `Ubs Gama` · `Ubs 1 - São Sebastião` (CNES `0010790`) / `Ubs 1 Sao Sebastiao`
- `Ubs São Sebastião` ×5 (IDs sequenciais `…22a`–`…22e`, todos "Rod Df 465 Km Nº 04 Fazenda Papuda", coords a ~150 m, todos sem CNES)

Mecanismo provado (`SeedMapper.java:67-74,216-223`, `SeedRunner.java:187-219`, + dumps das camadas via `mapshaper`):

1. As camadas **Indígena e Rua repetem unidades da camada principal** (`indig.csv`/`rua.csv` contêm "UBS 1 - São Sebastião", "UBS 2 - Asa Norte"…), **sem coluna CNES** e com pontos ~20 m deslocados.
2. Sem CNES, a chave é `sha256(categoria|nomeCanonico|lon|lat)` — coords diferentes → chave diferente → **insert em vez de match**, mesmo sendo a mesma unidade.
3. A camada **Prisionais não tem coluna de nome**: o fallback `nome = "UBS " + RA` (`SeedMapper.java:67-74`) batiza as 5 linhas da Papuda (e as 2 da Granja) com o **mesmo nome sintético** — pontos distintos (possíveis unidades distintas do complexo), nome idêntico.

## 3. Validação endereços × coordenadas (pedido do PO)

- **Bbox DF:** todas as 340 unidades têm `localizacao` (0 sem ponto) — o filtro de bbox do seed (`coordenadaValida`) está íntegro.
- **Endereços presentes:** logradouro/numero/bairro/CEP preenchidos nos grupos auditados; grafias duplicadas (`Sao`/`São`, `Ssb`) são herança das fontes, não erro de importação.
- **O que NÃO foi validado:** ground-truth rua a rua das 340 unidades (exigiria geocodificação externa — fora do escopo desta auditoria). O par DUP-03 é o único erro de apontamento **provado**; os demais pontos são consistentes com seus endereços no nível de quadra/conjunto.
- **Limite do relatório:** lista (`GET /hospitais`) não expõe `codigoCnes`/`importKey` — a classificação "órfão" é por (nome canônico + endereço + ausência na fonte atual), não por chave interna. Auditoria complementar possível com acesso ao Atlas.

## 4. Lista de ação (IDs do backend de dev em 12/09/2026)

**Candidatos a remoção (exige backup + decisão do PO):** os docs **sem CNES** dos 9 grupos com gêmeo CNES (critério mecânico: a versão CNES tem coordenadas e atributos autoritativos) — p.ex. `cc16fac635a7…` ("Ubs 1 - Asa Sul"), `7f1844d981b6…` ("Ubs 1 - São Sebastião"). **Exceção:** os 5 Papuda (`…22a`–`…22e`) e os 2 "Ubs Gama" da Granja **não** entram na lista automática — sem gêmeo CNES e possivelmente unidades distintas do complexo; exigem verificação em campo/CNES antes de qualquer deleção.
**Correção manual (DUP-03):** `Ubs 01 Riacho Fundo I` × `Ubs 03 Riacho Fundo Ii` — levantar em campo/CNES qual ponto está certo; são endereços distintos (Qn 09 AE 11 × Qn 07 A/b).

## 5. Endurecimento do seed (implementado — `SeedRunner`, mesma branch)

Two-phase na execução: fase 1 monta tudo em memória; fase 2a grava os docs **com** CNES registrando a chave `categoria|nome canônico|bairro canônico`; fase 2b grava os sem-CNEs **exceto** gêmeos de chave já registrada (log `Gêmeo sem CNES ignorado`, contador no sumário). Pontos distintos sem gêmeo CNES (Papuda ×5) passam intactos — pontos não são fundidos. Cobertura: `SeedRunnerGemeosTest` (gêmeo ignorado × preservado × homônimos de RAs distintas), com fixtures `.shp`/`.dbf` mínimos gerados no teste.
Índice único esparso em `codigoCnes` foi avaliado e **rejeitado**: não teria evitado o DUP-01 (chaves distintas) e travaria a subida se o banco já contiver colisão.

## 6. Correção entregue no mapa (BUG-11)

`GeoLocalizacaoScreen.js` — `aoTocarGeofence`: 0 features → ignora; 1 → abre direto (comportamento anterior preservado); **2+ → `Alert` "Várias unidades neste local"** com um botão por unidade + Cancelar. Nomes repetidos ganham sufixo de distância do GPS (`utils/distancia.js` — haversine + `formatarDistancia`), resolvendo os 5 botões "Ubs São Sebastião" idênticos. Vale para duplicatas **e** co-localizações legítimas. Regressão em `GeoLocalizacaoScreen.test.js` (diálogo com 2 + Cancelar; escolha da 2ª navega para ela; caso único sem diálogo; sufixo de distância em colisão).
