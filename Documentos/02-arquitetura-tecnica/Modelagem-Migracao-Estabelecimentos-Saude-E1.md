# 🏥 Épico 01 — Modelagem e Plano de Migração de Estabelecimentos de Saúde (Brasília-DF)

> **Responsável:** Analista de Dados / Arquiteto de Banco de Dados
> **Tipo de entrega:** análise + modelagem + documentação (SEM codificação)
> **Destino da codificação:** Bruna (agente de back-end)
> **Data:** 19/08/2026
> **Base normativa:** Especificação da API v2.0 (§2.1 coleção `hospitais`) · Backlog v2.0 (Épico 1 — E1-01 a E1-05) · Documento Negocial v2.0 (RN-01..RN-24, LGPD)

---

## 0. Status da fonte de dados — ⚠️ BLOQUEANTE

### 0.1 A pasta de dados está VAZIA

O diretório indicado na tarefa **não contém nenhum arquivo**:

- Caminho informado na tarefa: `D:\saude-monitor\multiplas\_camadas\_saude\_14`
- Caminho real no disco: `D:\saude-monitor\multiplas_camadas_saude_14` (nome achatado, sem subpastas `_camadas\_saude\_14`)
- Conteúdo verificado: **0 arquivos, 0 bytes** (criado hoje, 19/08/2026 18:09)

Verificações executadas (todas sem resultados):

| Verificação | Resultado |
|---|---|
| `dir /s /b` na pasta | vazio |
| `glob **/*` na pasta | 0 arquivos |
| `where /r *.shp *.geojson *.csv` no projeto | nada |
| busca `geojson` / `hospitais` / `upa` / `ubs` em `D:\` | nada |
| pasta `Downloads` do usuário | apenas PDFs/instaladores, sem dado GIS |
| outras pastas `*multiplas*` em `D:\` | nenhuma |

**Conclusão:** os arquivos (shapefiles/CSV/GeoJSON) de Hospitais, UPAs e UBS de Brasília-DF **ainda não foram depositados** no repositório. A análise de estrutura real fica **condicionada** ao envio dos arquivos.

### 0.2 Ação necessária (dono da tarefa)

1. Baixar/obter os dados oficiais e depositá-los em `D:\saude-monitor\multiplas_camadas_saude_14\` (ou informar o caminho real).
2. Fontes prováveis para Brasília-DF:
   - **CNES / DATASUS** (Cadastro Nacional de Estabelecimentos de Saúde) — `ftp.datasus.gov.br` / portal `cnes.datasus.gov.br` (chave: código CNES).
   - **GeoPortal do DF (SEDUH/Codeplan)** — camadas "Unidades de Saúde" / "Equipamentos Públicos".
   - **IBGE** (malhas e endereços) como complemento.
3. Após o depósito, a seção §1 deve ser **revalidada campo a campo** contra os arquivos reais.

---

## 1. Análise da estrutura de dados (esperada)

Como os arquivos ainda não existem localmente, esta seção documenta a **estrutura provável** com base no enunciado ("nomes e endereços dos Hospitais, UPAs e UBS de Brasília-DF") e no padrão de dados abertos de saúde do Brasil. É um **gabarito adaptativo**: ao receber os arquivos, o mapeamento abaixo deve ser conferido e ajustado.

### 1.1 Formatos prováveis

| Formato | Arquivos | Observações |
|---|---|---|
| **Shapefile (ESRI)** | `.shp` (geometria) + `.dbf` (atributos) + `.shx` + `.prj` (CRS) + `.cpg` (encoding) | Mais comum em órgãos públicos. Geometria normalmente **Point** (um ponto por estabelecimento). |
| **CSV / XLSX** | um único arquivo com colunas `lat`/`long` | Sem geometria; coordenadas em colunas de texto. |
| **GeoJSON** | `.geojson` / `.json` | FeatureCollection de `Point` (eventualmente `Polygon` se já houver geofence). |

> ⚠️ **Ponto de atenção 1 (CRS):** shapefiles do DF frequentemente vêm em **SIRGAS 2000 (EPSG:4674)** ou projeção **UTM (EPSG:31983 / 32723)**. Para o GeoJSON/MongoDB o padrão obrigatório é **WGS84 (EPSG:4326)**, coordenadas `[longitude, latitude]`. A migração precisa **detectar e reprojetar** se necessário.
>
> ⚠️ **Ponto de atenção 2 (encoding):** atributos em `.dbf` costumam vir em **CP1252/Latin-1**; normalizar para **UTF-8** (acentos de "Brasília", "Asa Norte" etc.).

### 1.2 Mapeamento de campos (fonte → destino)

Tabela de equivalência entre os nomes de coluna típicos da fonte (CNES/GeoPortal DF) e o modelo alvo (§2):

| Campo-fonte provável | Tipo fonte | Campo-alvo (§2) | Tipo alvo |
|---|---|---|---|
| `CNES` / `CODUFM`+`CNES` | string (7) | `cnes` | string (7 dígitos, `String.format("%07d")`) |
| `NOME_FANTASIA` / `FANTASIA` | string | `nomeFantasia` | string |
| `RAZAO_SOCIAL` / `NOME` / `NO_FANTASIA` | string | `nome` | string (normalizado) |
| `TP_UNIDADE` / `DESC_TP_UNIDADE` / `TIPO_UNIDADE` | código/string | `categoria` | enum derivado (§2.3) |
| `ESFERA_ADMINISTRATIVA` / `TP_GESTAO` / `NATUREZA` | código | `tipo` | enum PUBLICO\|PRIVADO\|FILANTROPICO |
| `CNPJ` / `NU_CNPJ` | string (14) | `cnpj` | string formatada (opcional) |
| `LOGRADOURO` / `DS_ENDERECO` | string | `endereco.logradouro` | string |
| `NUMERO` / `NU_ENDERECO` | string | `endereco.numero` | string |
| `COMPLEMENTO` | string | `endereco.complemento` | string (nullable) |
| `BAIRRO` | string | `endereco.bairro` | string |
| `MUNICIPIO` / `CIDADE` | string | `endereco.cidade` | string |
| `UF` / `SIGLA_UF` | string (2) | `endereco.uf` | string upper |
| `CEP` / `CO_CEP` | string (8) | `endereco.cep` | string formatada `#####-###` |
| `LONGITUDE` / `X` / geometria Point | double | `localizacao.coordinates[0]` | double |
| `LATITUDE` / `Y` / geometria Point | double | `localizacao.coordinates[1]` | double |
| `TELEFONE` / `NU_TELEFONE` | string | `contato.telefone` | string normalizada |
| `EMAIL` | string | `contato.email` | string lower (opcional) |

### 1.3 Derivação do enum `categoria` (Hospital / UPA / UBS)

O dado-fonte traz um **código de tipo de unidade** (CNES `TP_UNIDADE`) que deve ser mapeado para categorias canônicas:

| Código/fonte | Descrição CNES | `categoria` alvo |
|---|---|---|
| 05, 07, 15, 20, 21, 22, 36, 62… | Hospital geral / especializado / maternidade / dia | `HOSPITAL` |
| 73, 74… | Unidade de Pronto Atendimento (UPA 24h) | `UPA` |
| 02, 01, 71, 72… | Centro de Saúde / Unidade Básica | `UBS` |
| 04, 39, 68… | Policlínica / clínica especializada | `POLICLINICA` (ou `OUTRO`) |
| demais | laboratório, farmácia, etc. | `OUTRO` |

> O mapeamento exato depende do dicionário de `TP_UNIDADE` do arquivo real; esta tabela é **referencial** e deve ser confirmada na importação (ver §3.3).

---

## 2. Modelagem do esquema — coleção `hospitais`

### 2.1 Princípio

O modelo é **alinhado à spec v2.0 §2.1**, porém **estendido** para atender ao escopo real do Épico 01 (Hospitais + UPAs + UBS), que a spec atual (focada em "hospitais") não cobre por completo. As extensões estão marcadas como **[EXT]** e exigem **aprovação de emenda na spec**.

### 2.2 Documento alvo (JSON)

```json
{
  "_id": "652c9f3e1a2b3c4d5e6f7080",
  "cnes": "0012345",                                  // [EXT] chave estável do CNES (7 dígitos)
  "nome": "Hospital Regional da Asa Norte",
  "nomeFantasia": "HRAN",                             // [EXT] opcional
  "categoria": "HOSPITAL",                            // [EXT] HOSPITAL | UPA | UBS | POLICLINICA | OUTRO
  "tipo": "PUBLICO",                                  // natureza/esfera (spec) PUBLICO | PRIVADO | FILANTROPICO
  "cnpj": "12.345.678/0001-90",                       // opcional (null p/ UPAs/UBS sob gestão municipal)
  "endereco": {
    "logradouro": "SMHN Quadra 02",
    "numero": "s/n",
    "complemento": null,
    "bairro": "Asa Norte",
    "cidade": "Brasília",
    "uf": "DF",
    "cep": "70710-100"
  },
  "localizacao": {                                    // [EXT] ponto exato vindo da fonte
    "type": "Point",
    "coordinates": [-47.9123, -15.7890]               // [longitude, latitude]
  },
  "geofence": {                                       // polígono para detecção (spec)
    "type": "Polygon",
    "coordinates": [ [ [-47.9100, -15.7890], "... anel fechado ...", [-47.9100, -15.7890] ] ]
  },
  "geofenceOrigem": "AUTO_BUFFER",                    // [EXT] AUTO_BUFFER | MANUAL
  "contato": {
    "telefone": "(61) 3325-0000",
    "email": "ouvidoria@hran.saude.df.gov.br"         // opcional
  },
  "fonte": "CNES_202608",                             // [EXT] rastreabilidade da importação
  "ativo": true,
  "criadoEm": "2026-08-19T18:00:00Z",
  "atualizadoEm": "2026-08-19T18:00:00Z"
}
```

### 2.3 Campos, tipos e regras

| Campo | Tipo | Obrig. | Regra / enum |
|---|---|---|---|
| `_id` | ObjectId | auto | — |
| `cnes` | string (7) | ✅ | numérico, zero-padded a 7; **único** |
| `nome` | string | ✅ | oficial; normalizado para dedup (§3.4) |
| `nomeFantasia` | string | ✱ | opcional |
| `categoria` | enum | ✅ | `HOSPITAL` \| `UPA` \| `UBS` \| `POLICLINICA` \| `OUTRO` |
| `tipo` | enum | ✅ | `PUBLICO` \| `PRIVADO` \| `FILANTROPICO` |
| `cnpj` | string (18) | ✱ | formatado `XX.XXX.XXX/XXXX-XX`; **único esparso** (nullable) |
| `endereco` | objeto | ✅ | subcampos abaixo |
| `endereco.logradouro` | string | ✅ | trim + título |
| `endereco.numero` | string | ✱ | pode ser `s/n` |
| `endereco.complemento` | string | ✱ | nullable |
| `endereco.bairro` | string | ✅ | trim + título |
| `endereco.cidade` | string | ✅ | default `Brasília` |
| `endereco.uf` | string (2) | ✅ | uppercase, `DF` |
| `endereco.cep` | string (9) | ✱ | `#####-###` |
| `localizacao` | GeoJSON Point | ✅ | `[lon, lat]`, válido (§3.5) |
| `geofence` | GeoJSON Polygon | ✅ | anel fechado, ≥ 4 vértices, sem auto-interseção |
| `geofenceOrigem` | enum | ✅ | `AUTO_BUFFER` \| `MANUAL` |
| `contato.telefone` | string | ✱ | `(XX) XXXXX-XXXX` |
| `contato.email` | string | ✱ | lowercase |
| `fonte` | string | ✅ | lote de importação |
| `ativo` | boolean | ✅ | default `true` |
| `criadoEm` / `atualizadoEm` | ISO 8601 | ✅ | UTC |

### 2.4 Índices

```javascript
// 1. Geoespaciais (obrigatórios)
db.hospitais.createIndex({ "localizacao": "2dsphere" });   // busca por proximidade ($nearSphere)
db.hospitais.createIndex({ "geofence": "2dsphere" });      // detecção de entrada ($geoIntersects)

// 2. Unicidade
db.hospitais.createIndex({ "cnes": 1 }, { unique: true });                       // chave primária de negócio
db.hospitais.createIndex({ "cnpj": 1 }, { unique: true, sparse: true });         // CNPJ é opcional
db.hospitais.createIndex({ "nomeNormalizado": 1 }, { unique: true });            // dedup de nome

// 3. Busca / filtro (API pública)
db.hospitais.createIndex({ "ativo": 1, "categoria": 1, "tipo": 1 });
db.hospitais.createIndex({ "endereco.cidade": 1, "endereco.uf": 1 });
```

> **Nota:** `nomeNormalizado` é um campo derivado (slug: minúsculas, sem acentos, espaços colapsados) usado **apenas** para dedup/unicidade; não é exposto na API.

### 2.5 Decisões de modelagem (com justificativa)

1. **Duas dimensões ortogonais — `categoria` × `tipo`.** `categoria` responde "o que é?" (Hospital, UPA, UBS); `tipo` responde "de quem é?" (público, privado, filantrópico). A spec v2.0 só tem `tipo`; sem `categoria` o app não consegue filtrar "só UPAs". **[Emenda de spec recomendada.]**

2. **`cnes` como chave estável em vez de `cnpj`.** UPAs e UBS públicas são geridas pelo município e **não possuem CNPJ próprio**; o identificador universal de estabelecimento de saúde no Brasil é o **código CNES (7 dígitos)**. `cnpj` vira opcional/esparso. **[Emenda de spec recomendada.]**

3. **`localizacao` (Point) ≠ `geofence` (Polygon).** A fonte entrega **pontos** (a localização do prédio). O geofencing do produto precisa de **polígonos**. Logo:
   - `localizacao` guarda o ponto exato da fonte (verdade de origem);
   - `geofence` é **derivado** na migração como buffer circular (raio padrão 150 m, ajustável por categoria — ver §3.6) e **refinado manualmente** pelo admin depois (E1-02).
   - `geofenceOrigem` marca se o polígono é automático (`AUTO_BUFFER`) ou curado (`MANUAL`). **[Emenda de spec recomendada.]**

4. **`endereco` estruturado (objeto), não string única.** A spec já prevê objeto; expandimos com `numero`, `complemento`, `bairro` para suportar normalização e futura geocodificação reversa.

5. **`fonte` para rastreabilidade.** Toda importação carrega um lote (`CNES_202608`), permitindo auditoria, reprocessamento seletivo e rollback por lote.

---

## 3. Plano de migração / importação (passo a passo)

> Etapas executadas **pela Bruna** (codificação). Este plano é a especificação funcional do processo.

### Fase A — Preparação e extração
1. **Inventário** dos arquivos em `multiplas_camadas_saude_14\` (tipo, tamanho, encoding, CRS).
2. **Leitura** com driver adequado (shp→`geotools`/`ogr2ogr`; CSV→pandas/OpenCSV; GeoJSON→Jackson).
3. **Detecção de CRS** via `.prj` e **reprojeção para EPSG:4326** se necessário (UTM/SIRGAS2000).
4. **Decodificação** CP1252/Latin-1 → UTF-8.
5. **Projeção de volume**: expectativa ~250 registros (≈50 hospitais + ≈30 UPAs + ≈160 UBS em Brasília-DF) — lote pequeno, pode rodar online.

### Fase B — Normalização
6. `cnes`: strip não-dígitos; zero-pad à esquerda (7); validar dígito verificador (algoritmo CNES) quando disponível.
7. `cnpj`: strip para 14 dígitos; reformatar `XX.XXX.XXX/XXXX-XX`; marcar vazio como `null`.
8. `nome`: trim, colapsar espaços duplos, Title Case; gerar `nomeNormalizado` (minúsculas, sem acento, sem pontuação).
9. `endereco`: trim + Title Case em logradouro/bairro/cidade; UF uppercase; CEP strip→`#####-###`.
10. `telefone`: strip não-dígitos → `(XX) XXXXX-XXXX`; `email` lowercase.
11. `categoria` / `tipo`: mapear códigos-fonte para enums canônicos (§1.3) com tabela de tradução **versionada** e `OUTRO`/`null` como fallback explícito (nunca silencioso).

### Fase C — Validação de coordenadas (crítica)
12. Faixa global: `lat ∈ [-90, 90]`, `lon ∈ [-180, 180]`.
13. **Bounding box do DF**: `lat ∈ [-16.20, -15.40]`, `lon ∈ [-48.30, -47.30]`. Pontos fora → quarentena para revisão manual (possível erro de CRS ou dado fora do escopo).
14. Rejeitar pares nulos ou `(0,0)` (no oceano).
15. Consistência **ponto × endereço**: validar que a coordenada cai no bairro/RA informado (heurística leve; opcional na v1).
16. Gerar relatório `validos | quarentenados | rejeitados` com motivo por registro.

### Fase D — Deduplicação
17. **Chave primária: `cnes`** (exato, após strip). Duplicado de `cnes` no mesmo lote → manter o registro mais completo (mais campos preenchidos) e logar o descartado.
18. **Fallback sem CNES:** dedup por `nomeNormalizado` + proximidade espacial (dois pontos < 50 m são o "mesmo" estabelecimento).
19. **Near-duplicates** (mesmo nome com grafia distinta, ou mesma coordenada com nomes diferentes) → lista para **revisão manual**, nunca descarte automático.
20. **Conflito com dados já existentes no banco:** upsert por `cnes`; se `cnes` ausente, tentar `nomeNormalizado` + `localizacao` próximo. Sempre preservar `geofence` **MANUAL** (não sobrescrever cura humana com buffer automático).

### Fase E — Geração do geofence (buffer)
21. Para cada `localizacao` Point, gerar **Polygon circular** (N=32 vértices) com raio por categoria:

| `categoria` | raio padrão |
|---|---|
| `HOSPITAL` | 200 m |
| `UPA` | 150 m |
| `UBS` | 100 m |
| demais | 150 m |

22. Marcar `geofenceOrigem = AUTO_BUFFER`. (O raio é **calibrável** — alinhar com RN e o teste de campo do S2/S3; range proposto na doc: 100–150 m.)

### Fase F — Importação
23. **Dry-run primeiro:** validar 100% do lote sem escrever; emitir relatório de auditoria.
24. **Gravação** em `upsert` (por `cnes`) com `bulkWrite` ordenado; idempotente (re-rodar não duplica).
25. Gravar `fonte`, `criadoEm`/`atualizadoEm` (UTC).
26. **Transação/checkpoint**: se lote > registros que caibam numa escrita atômica, processar por blocos com checkpoint e resumo final.

### Fase G — Índices e verificação
27. Criar/garantir os índices de §2.4 **após** a carga (evita lentidão na inserção; `createIndex` em background).
28. **Verificação pós-carga:**
    - contagem total vs. relatório (nenhum registro perdido);
    - amostra de `$geoIntersects`/`$nearSphere` para validar índices 2dsphere;
    - checagem de unicidade (`cnes`, `cnpj`, `nomeNormalizado`);
    - nenhum `geofence` inválido (anel aberto / auto-interseção).
29. **Rollback:** por `fonte` (lote) — `deleteMany({ fonte: "<lote>" })`; nunca afeta registros de outros lotes.

### Critérios de conclusão (Definition of Ready para a Bruna)
- [ ] 100% dos registros importados com `cnes` único e `categoria`/`tipo` resolvidos.
- [ ] 0 registros com coordenada fora do bounding box do DF sem justificativa.
- [ ] 100% dos `geofence` são Polygon válido (fechado, ≥ 4 vértices, sem auto-interseção).
- [ ] Relatório de auditoria gerado (validos/quarentenados/rejeitados + duplicados).
- [ ] Índices 2dsphere e de unicidade criados e verificados.

---

## 4. Handoff para a Bruna (especificação de codificação)

Abaixo, o **escopo de implementação** que deve ser repassado à Bruna. Esta entrega **não codifica** — apenas especifica.

### 4.1 Entidades/classes de dados (backend Spring Boot + MongoDB)
- **`EstablishmentDocument`** (coleção `hospitais`): espelhar §2.2 (inclui `cnes`, `categoria`, `tipo`, `localizacao` Point, `geofence` Polygon, `endereco` objeto, `contato`, `fonte`).
- **Índices** via `@Indexed` / `@GeoSpatialIndexed` ou migration runner (2dsphere ×2, unique ×3, composto ×1) conforme §2.4.
- **Enums** `Categoria` e `TipoEstabelecimento` com mapeamento §1.3/§2.3.

### 4.2 Script/rotina de importação
- Um **runner/utility** (ex.: Spring `CommandLineRunner` ou ferramenta CLI separada) que executa as Fases A–G de §3, com:
  - `--dry-run` e `--batch=<lote>`;
  - relatório em Markdown/JSON no diretório `Documentos/07-dados/` (ou equivalente);
  - leitura de shapefile (geotools) + CSV + GeoJSON;
  - reprojeção EPSG:4674/UTM → EPSG:4326;
  - validação de coordenadas e bounding box DF;
  - geração de buffer circular → Polygon (N=32) com raio por categoria;
  - upsert idempotente por `cnes`.

### 4.3 Pontos de atenção na codificação
1. **Não sobrescrever** `geofence` de origem `MANUAL` em reimportações.
2. **Encoding** CP1252 → UTF-8 antes de qualquer normalização.
3. **CNPJ nulo** deve respeitar índice `sparse: true` (não gerar colisão de `null`).
4. **GeoJSON** sempre `[longitude, latitude]` (RFC 7946) — não inverter com `lat,long`.
5. Emitir **erros no envelope padrão** da spec (código + mensagem pt-BR + traceId) quando aplicável.

### 4.4 Testes (a especificar junto à Bruna)
- Teste de normalização (CNES zero-pad, CNPJ máscara, CEP, acentos).
- Teste de reprojeção (fixture UTM → WGS84 com ponto conhecido).
- Teste de validação de coordenadas (fora de DF, `(0,0)`, null).
- Teste de geração de buffer (raio → polígono fechado, N vértices, área esperada).
- Teste de dedup (mesmo CNES, nome grafia distinta, ponto duplicado).
- Teste de idempotência (rodar 2× não duplica).
- Teste de índice 2dsphere (`$geoIntersects`, `$nearSphere`).

---

## 5. Pendências e decisões aguardando o dono

| # | Pendência | Impacto |
|---|---|---|
| 1 | **Depositar os arquivos** em `multiplas_camadas_saude_14\` | Bloqueia §1 (análise real) e a codificação |
| 2 | Confirmar **emenda de spec**: adicionar `categoria`, `cnes`, `localizacao`, `geofenceOrigem`, `fonte` | Alinhamento do contrato de API |
| 3 | Aprovar **raio de buffer** por categoria (100/150/200 m) | Calibragem do geofence |
| 4 | Definir **fonte oficial** dos dados (CNES vs GeoPortal DF) | Rastreabilidade e qualidade |
| 5 | Aprovar **dedup por `cnes`** como chave primária de negócio | Unicidade e idempotência |

---

*Fim — entrega de análise, modelagem e documentação do Épico 01. Nenhuma linha de código foi produzida; a codificação é de responsabilidade da Bruna (back-end), conforme especificação acima.*
