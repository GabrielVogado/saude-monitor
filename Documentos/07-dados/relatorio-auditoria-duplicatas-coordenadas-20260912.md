# Auditoria — unidades duplicadas e coordenadas suspeitas (12/09/2026)

> **Origem:** relato do PO com evidência em aparelho — "vários círculos amontoados" em São Sebastião (UPA + UBSs + Casa de Parto) + pedido de validação de endereços/lat/lon.
> **Método (Zero-Trust):** catálogo completo do backend de dev (`GET /api/v1/hospitais` paginado, 340 docs, 12/09/2026) cruzado com os arquivos-fonte do seed (`backend/data/*.shp/.dbf`, exportação de 25/08/2026) via `mapshaper`. Nenhuma afirmação abaixo é visual — todas têm contagem.
> **Escopo do dado:** banco de **dev**. Nenhuma deleção foi executada (sem acesso ao Atlas por aqui + ação destrutiva exige decisão do PO com backup).

## 1. Veredito em uma tabela

| # | Achado | Medição | Classificação | Ação |
|---|---|---|---|---|
| DUP-01 | 10 grupos de mesmo nome, 23 docs (ex.: "Ubs São Sebastião" ×5, "Ubs 2 - Asa Norte" ×3) | pares com coords de precisão alta × arredondadas a 4 casas + variantes de grafia (`-`/`ã`) | **Órfãos de re-seeds**: `importKey = sha256(categoria\|nome\|lon\|lat)` — cada seed com arquivo de versão diferente gera chave nova; o upsert nunca remove os antigos | Limpeza com backup (lista no §4) + endurecer seed (§5) |
| DUP-02 | 7 pares de coords exatas, nomes diferentes | 5× Cepav dividindo o ponto do hospital/UBS que as abriga (mesmo endereço/CEP) → **co-localização legítima** | Manter | Mapa precisa de desambiguação (BUG-11, entregue) |
| DUP-03 | `Ubs 01 Riacho Fundo I` × `Ubs 03 Riacho Fundo Ii` — **mesma coordenada, endereços diferentes** (Qn 09 × Qn 07) | 1 par | **Coordenada errada em pelo menos um dos dois** (não há como dois endereços distintos ocuparem o mesmo ponto) | Correção manual (não automatizável — §4) |
| DUP-04 | 77 pares < 50 m não-exatos (CAPS+UBS, UPA+laboratório…) | endereços do mesmo complexo assistencial | Vizinhança real | Desambiguação de toque (BUG-11) |

## 2. Evidência central (DUP-01)

As fontes atuais **não contêm** os duplicados: `Unidade_Básica_de_Saúde` tem 183 pontos = 183 linhas DBF, **0 nomes duplicados** (idem na cópia `multiplas_camadas_saude_14/`); "Papuda" não aparece em nenhum CSV de nenhuma camada. Logo os 23 docs órfãos vieram de **versões anteriores dos arquivos** (nomes com `-`/acentos, p.ex. "Ubs 1 - Paranoa" × "Ubs 1 - Paranoá").

Padrão que fecha o diagnóstico — cada grupo tem a variante **precisão cheia** × **arredondada a 4 casas**:

- `Ubs 1 - Asa Sul`: `-15.83276899968653` × `-15.8328` (mesmo endereço Sgas 612)
- `Ubs 2 - Asa Norte` ×3 · `Ubs 1 - Paranoa/Paranoá` · `Ubs 1 - Sobradinho` · `Ubs 2 - Itapoa` · `Ubs 4 - Gama` · `Ubs 5 - Ceilândia` · `Ubs Gama` · `Ubs 1 - São Sebastião`/`Ubs 1 Sao Sebastiao`
- `Ubs São Sebastião` ×5 (IDs sequenciais `…22a`–`…22e`, todos "Rod Df 465 Km Nº 04 Fazenda Papuda", coords a ~150 m entre si)

Mecanismo (`SeedMapper.java:216-223`, `SeedRunner.java:177,215-216`): sem CNES válido, a chave é `sha256(categoria|nomeCanonico|lon|lat)`. Mudou uma casa decimal da coordenada ou um acento do nome entre versões → chave nova → **insert em vez de update**, e o documento antigo vira órfão permanente (nenhum passo do seed remove).

## 3. Validação endereços × coordenadas (pedido do PO)

- **Bbox DF:** todas as 340 unidades têm `localizacao` (0 sem ponto) — o filtro de bbox do seed (`coordenadaValida`) está íntegro.
- **Endereços presentes:** logradouro/numero/bairro/CEP preenchidos nos grupos auditados; grafias duplicadas (`Sao`/`São`, `Ssb`) são herança das fontes, não erro de importação.
- **O que NÃO foi validado:** ground-truth rua a rua das 340 unidades (exigiria geocodificação externa — fora do escopo desta auditoria). O par DUP-03 é o único erro de apontamento **provado**; os demais pontos são consistentes com seus endereços no nível de quadra/conjunto.
- **Limite do relatório:** lista (`GET /hospitais`) não expõe `codigoCnes`/`importKey` — a classificação "órfão" é por (nome canônico + endereço + ausência na fonte atual), não por chave interna. Auditoria complementar possível com acesso ao Atlas.

## 4. Lista de ação (IDs do backend de dev em 12/09/2026)

**Órfãos candidatos a remoção (23 docs — exige backup + decisão do PO):**
`6a8f63f15b4dd128ce51b22a` · `…22b` · `…22c` · `…22d` · `…22e` (Papuda ×5 — manter no máximo 1, se a unidade existir) + os pares dos 9 demais grupos do §2 (manter 1 por grupo; critério sugerido: o doc cujas coords batem com a fonte atual).
**Correção manual (DUP-03):** `Ubs 01 Riacho Fundo I` × `Ubs 03 Riacho Fundo Ii` — levantar em campo/CNES qual ponto está certo; são endereços distintos (Qn 09 AE 11 × Qn 07 A/b).

## 5. Endurecimento do seed (recomendado, não implementado)

1. Passo de **reconciliação pós-upsert**: docs do banco cujo `(categoria, nomeCanonico)` não existe na importação corrente → relatório (nunca deleção automática).
2. `importKey` sem coordenadas (`categoria|nomeCanonico`) **não** é seguro sozinho: nomes se repetem entre RAs — exigiria `(categoria|nomeCanonico|RA)` e auditoria prévia.
3. Índice único esparso em `codigoCnes` limita o estrago futuro com CNES, mas **não teria evitado** o DUP-01 (chaves distintas) — por isso ficou fora deste PR.

## 6. Correção entregue no mapa (BUG-11)

`GeoLocalizacaoScreen.js` — `aoTocarGeofence`: 0 features → ignora; 1 → abre direto (comportamento anterior preservado); **2+ → `Alert` "Várias unidades neste local"** com um botão por unidade + Cancelar. Vale para duplicatas **e** co-localizações legítimas. Regressão em `GeoLocalizacaoScreen.test.js` (diálogo com 2 + Cancelar; escolha da 2ª navega para ela; caso único sem diálogo).
