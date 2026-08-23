# 🔗 Épico 01 — Enriquecimento de CNES via DATASUS (registros sem CNES)

> **Responsável:** Analista de Dados / Arquiteto de Banco de Dados
> **Tipo de entrega:** especificação técnica (SEM codificação)
> **Destino da codificação:** Bruna (agente de back-end)
> **Data:** 20/08/2026
> **Base normativa:** `Modelagem-Migracao-Estabelecimentos-Saude-E1.md` · `Pendencias-Epico-01.md` (item a) · `Especificacao-API-v2.0.md` (§2.1 coleção `hospitais`) · Lei 12.527/2011 (dados abertos)

---

## 1. Objetivo e escopo

A importação do Épico 01 carregou **340 estabelecimentos** de Brasília-DF na coleção
`hospitais`. **100 registros (29,4%) ficaram sem `codigoCnes`**, dependendo da chave de
fallback `importKey` (sha256 de categoria+nome+coordenada). A distribuição é:

| Categoria | Sem CNES | Origem do débito |
|---|---|---|
| HOSPITAL | 16 | camada `Hospitais` não tem coluna CNES |
| UPA | 13 | camada `Unidades_de_Pronto_Atendi` sem CNES |
| UBS (variantes) | 23 | Prisionais 9 · Indígena 7 · Consultório na rua 7 |
| OUTRO | 48 | 18 CAPs sem coluna CNES + 30 com coluna CNES **vazia** |

**Objetivo:** substituir o fallback `importKey` por `codigoCnes` oficial do **CNES/DATASUS**,
preservando a idempotência de reimportação e mantendo rastreabilidade de auditoria.

**Escopo (exclusivo Épico 01):**

- ✅ Enriquecer os ~100 registros sem `codigoCnes`.
- ✅ Definir fonte, estratégia de casamento, fluxo de gravação e revisão manual.
- ✅ Garantir idempotência com o pipeline `etl/importar_estabelecimentos.py` já existente.
- ❌ Fora de escopo: geofences manuais (E1-02), indicadores (Épico 04), auth/JWT, e a
  revalidação dos 240 registros que já possuem CNES (apenas reconciliação opcional, §8.7).

> **Nomenclatura usada neste documento:** a coleção real usa `codigoCnes` (campo de negócio,
> 7 dígitos) e `importKey` (fallback). O documento de modelagem usa `cnes`; considera-se
> **`cnes` ≡ `codigoCnes`** para efeito de contrato. Nenhum campo novo de chave deve ser criado.

---

## 2. Fonte definitiva de dados

### 2.1 Decisão

**FONTE PRIMÁRIA — Portal de Dados Abertos do SUS, dataset "CNES — Cadastro Nacional de
Estabelecimentos de Saúde", recurso "Arquivos Totais Unidades" (CSV).**

- Endereço: `https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude`
- Atualização: **20/08/2026** (frequência diária), alinhado ao lote atual da importação.
- Formato: **CSV pronto** (sem necessidade de descompressão DBC), colunas oficiais do
  cadastro nacional, incluindo lat/long (`NU_LATITUDE`/`NU_LONGITUDE`) e tipo de unidade
  (`TP_UNIDADE`).

**FONTE SECUNDÁRIA / FALLBACK — PySUS (`pysus.online_data.CNES`) sobre o FTP do DATASUS
(arquivos `ST` em formato DBC).**

- Repositório: `github.com/AlertaDengue/PySUS`.
- Usar apenas se o CSV do Portal estiver indisponível, defasado ou truncado para o DF.

### 2.2 Justificativa da escolha

| Critério | Dados Abertos (CSV) | PySUS/FTP (DBC) |
|---|---|---|
| Parsing | direto (CSV UTF-8) | exige decodificar DBC (PKWare DCL) |
| Lat/Long | presente (`NU_LATITUDE`/`NU_LONGITUDE`) | depende da safra do ST |
| `TP_UNIDADE` (bloqueio por categoria) | presente | presente |
| Atualização | diária, espelhada do CNES | diária (FTP) |
| Dependências no `etl/.venv` | nenhuma nova | `pysus` + decoder DBC |
| Curadoria de campos | colunas nomeadas | nomes DBF encurtados (ex.: `NO_FANTASIA`→`NO_FANTAS`) |

O CSV elimina o passo mais frágil (decodificação DBC) e já entrega a maioria dos campos de
casamento nomeados. O PySUS permanece como plano B documentado.

### 2.3 Campos relevantes do arquivo CNES (referência de casamento)

| Campo CNES | Uso no casamento |
|---|---|
| `CO_UNIDADE` (CNES, 7 díg.) | **alvo** — chave de negócio a gravar em `codigoCnes` |
| `NO_FANTASIA` / `NO_RAZAO_SOCIAL` | nome (casar contra **ambos**, §4.3) |
| `TP_UNIDADE` / `DS_TIPO_UNIDADE` | bloqueio por categoria (§4.2) |
| `NO_LOGRADOURO` + `NU_ENDERECO` | endereço |
| `NO_BAIRRO` | bairro (⚠️ não é a RA do DF — ver §4.4) |
| `CO_CEP` | CEP (8 dígitos) |
| `CO_UF` / `CO_MUNICIPIO` | filtro geográfico (UF DF = `53`; mun. DF = `530010`) |
| `NU_LATITUDE` / `NU_LONGITUDE` | casamento geoespacial (boost/tiebreak, §4.5) |
| `TP_GESTAO` / `NATUREZA_ORGANIZACAO` | não usado (mantemos `tipo = PUBLICO`) |

> **Filtro obrigatório na extração:** `CO_UF == "53"` (Distrito Federal). Como o DF é
> município único, `CO_MUNICIPIO == "530010"` (Brasília) para todos; o campo **não discrimina**
> entre estabelecimentos do DF — a discriminação vem de nome + endereço + geo (§4).

---

## 3. Preparação da referência CNES

### 3.1 Download e recorte

1. Baixar o CSV "Arquivos Totais Unidades" (Brasil inteiro).
2. Filtrar `CO_UF == "53"`. Resultado esperado: alguns milhares de linhas (todo o DF,
   incluindo estabelecimentos que **não** fazem parte dos nossos 340 — o casamento deve
   simplesmente não encontrar par, sem erro).
3. Gravar o recorte local em `etl/dados/cnes_df_referencia_<lote>.csv` (pasta nova,
   **gitignorada**; a referência é regenerável a partir da fonte oficial).

### 3.2 Normalização da referência (idêntica à usada no casamento)

- `CNES`: strip não-dígitos → `zfill(7)`.
- `NO_FANTASIA`/`NO_RAZAO_SOCIAL`: normalização de nome completa (§4.3), gerando
  `nome_canonico`.
- `NO_LOGRADOURO`/`NU_ENDERECO`: normalização de endereço (§4.4).
- `CO_CEP`: 8 dígitos, sem máscara (comparação numérica).
- `NU_LATITUDE`/`NU_LONGITUDE`: converter para `float`; tratar `null`/`0` como **ausente**
  (geo vira só boost, nunca gate — §4.5).

### 3.3 Tabela `TP_UNIDADE` → `categoria` (bloqueio)

A categoria do nosso lado é `HOSPITAL | UPA | UBS | OUTRO`. O CNES traz `TP_UNIDADE`
(código numérico). A tabela abaixo é **referencial** — deve ser validada contra o dicionário
oficial "Tipos de Estabelecimento" do CNES antes do uso, e **versionada** no artefato (§5.2).

| `categoria` (nosso) | `TP_UNIDADE` provável | Observação |
|---|---|---|
| HOSPITAL | 05, 07, 15, 20, 21, 62 | hospital geral/especializado/misto, PS, hospital-dia |
| UPA | 73 | Unidade de Pronto Atendimento 24h |
| UBS | 01, 02, 71, 72 | posto, centro de saúde/UBS, NASF/saúde da família |
| OUTRO | 04 (policlínica), 39, 36, 70 (CAPS), 69, demais | ver nota CAPS abaixo |

> ⚠️ **Regra de bloqueio rígida:** só se comparam registros cuja `categoria` seja igual.
> Um hospital **nunca** casa com uma UBS, mesmo com nome idêntico. Casos de `TP_UNIDADE`
> ambíguo (código sem mapeamento certo) vão para o bucket `OUTRO` e são tratados em
> revisão manual (§6).
>
> ⚠️ **CAPS:** os 18 CAPs do lote devem casar com `TP_UNIDADE = 70` (Centro de Atenção
> Psicossocial), não com clínica/policlínica. Validar o código exato no dicionário.

---

## 4. Estratégia de casamento (matching)

### 4.1 Visão geral

Casamento **determinístico em etapas**, do mais forte ao mais fraco, com pontuação ponderada
e classificação final em três níveis (`AUTO` / `REVIEW` / `PENDING`). O fluxo:

```
registro_sem_cnes
   └─ bloqueio por categoria (§4.2)
        └─ candidatos CNES do DF
             └─ scoring nome+endereço+CEP+geo (§4.3–4.5)
                  └─ classificação AUTO | REVIEW | PENDING (§4.6)
```

### 4.2 Bloqueio (redução de candidatos)

1. **Por categoria** (obrigatório) — via `TP_UNIDADE` (§3.3).
2. **Por prefixo de nome** — primeiros 3 caracteres do `nome_canonico` (após stopwords),
   para indexar a busca e evitar O(n×m) no universo inteiro do DF.
3. **Por CEP (quando presente dos dois lados)** — prefixo de 5 dígitos (nível logradouro).
   Bloqueio preferencial quando disponível; se um dos lados não tiver CEP, cair no prefixo
   de nome.

### 4.3 Normalização de nome (função única, aplicada aos dois lados)

1. `uppercase`.
2. Remover acentos (NFD, descartar categoria `Mn`).
3. Substituir não-alfanuméricos por espaço.
4. Normalizar numerais romanos (`III→3`, `II→2`, `IV→4`) para casar "Unidade III" × "Unidade 3".
5. Colapsar espaços.
6. Remover **stopwords**: partículas (`DE, DA, DO, DAS, DOS, E, EM, NA, NO, O, A`) e tokens
   de tipo **não discriminativos** dentro da própria categoria (`UBS, UNIDADE, BASICA,
   HOSPITAL, CENTRO, UPA, CAPS, DE, SAUDE, PRONTO, ATENDIMENTO`). **Manter** tokens que
   carregam valor discriminante (nomes próprios: "ASA NORTE", "GAMA", "TAGUATINGA",
   "SAMAMBAIA", "REGIONAL"…).

> O casamento de nome deve testar o `nome_canonico` do nosso registro contra **`NO_FANTASIA`
> E `NO_RAZAO_SOCIAL`** (ambos normalizados) e reter o **maior** escore — o lote da fonte
> pode usar fantasia ou razão social sem critério consistente.

### 4.4 Normalização e casamento de endereço

- **Logradouro:** uppercase, sem acento, expandir abreviaturas (`R→RUA`, `AV→AVENIDA`,
  `Q/QD→QUADRA`, `CONJ→CONJUNTO`, `LT→LOTE`, `S/N→SN`).
- **Número:** comparar token a token; `SN`/`S/N` casa com vazio.
- **CEP:** comparação exata de 8 dígitos (bônus forte) ou de 5 dígitos (bônus fraco).

> ⚠️ **NÃO comparar `endereco.bairro` (nosso) com `NO_BAIRRO` (CNES) diretamente.** O nosso
> campo `bairro` contém a **Região Administrativa** (Plano Piloto, Taguatinga, Ceilândia…),
> enquanto o CNES traz o **bairro/localidade** (Asa Norte, Águas Claras…). A consistência
> geográfica deve vir de **CEP + coordenada**, não do bairro. (Alternativa opcional: tabela
> RA↔bairro do GeoPortal/SEDUH — fora do escopo mínimo.)

### 4.5 Casamento geoespacial (boost, não gate)

Distância **haversine** entre `localizacao` (nosso, vinda do shapefile, precisa) e
`(NU_LONGITUDE, NU_LATITUDE)` (CNES, pode ser aproximada/ausente). Convertida em escore 0–100:

- `dist ≤ 50 m` → 100 · `50 m < dist ≤ 200 m` → decaimento linear até 60 ·
  `200 m < dist ≤ 1000 m` → decaimento até 0 · `dist > 1000 m` → 0 (ou penalidade).
- `NU_LATITUDE`/`NU_LONGITUDE` ausente/`0` no CNES → geo **neutro** (não penaliza nem
  pontua; o escore geo daquele par é ignorado e os pesos dos demais componentes são
  renomeados proporcionalmente).

### 4.6 Pontuação e limiares

Escore total (0–100), ponderação inicial **calibrável**:

```
total = 0.45 * nome_sim
      + 0.20 * endereco_sim
      + 0.15 * cep_bonus        // 100 se CEP 8d igual · 50 se 5d igual · 0 se divergente
      + 0.20 * geo_score
```

- `nome_sim` = `token_sort_ratio` (rapidfuzz) entre nomes canônicos (após stopwords).
- `endereco_sim` = média entre similaridade de logradouro (`ratio`) e igualdade de número.

**Classificação (por par vencedor — maior `total`):**

| Nível | Condição | Ação |
|---|---|---|
| **AUTO** | `nome_sim ≥ 90` **e** `total ≥ 80` **e** gap p/ 2º colocado `≥ 15` **e** (CEP 8d igual **ou** `dist ≤ 200 m`) | gravar `codigoCnes` automaticamente |
| **REVIEW** | `70 ≤ nome_sim < 90`, **ou** top-2 com gap `< 15`, **ou** conflito endereço/geo (CEP diverge **e** `dist > 500 m`) | fila de revisão manual (§6) |
| **PENDING** | `nome_sim < 70` (nenhum candidato plausível) | mantém `importKey`, registra motivo (§6) |

> **Limiares iniciais** (90 / 80 / 70 / gap 15 / 200 m) — devem ser **calibrados sobre uma
> amostra rotulada** de ~30 registros (misto das categorias) validada por humano antes da
> execução em produção. A calibração é pré-requisito de "Definition of Ready" (§7).

### 4.7 Biblioteca fuzzy recomendada

**`rapidfuzz`** (C++, MIT, fork mantido do `fuzzywuzzy`). Usar `fuzz.token_sort_ratio` para
nome (insensível a ordem), `fuzz.ratio` para logradouro, e `process.extract`/`extractOne`
com `score_cutoff` para a busca de candidatos dentro do bloco. **Descartar** `fuzzywuzzy`
legado (lento, descontinuado) e `difflib` (sem normalização de tokens).

---

## 5. Fluxo de atualização e idempotência

### 5.1 Princípio — artefato versionado como fonte de verdade

O enriquecimento **não é descartável**: o resultado do casamento precisa sobreviver a
reimportações do CSV de origem (que **continuarão sem CNES**). Por isso, a gravação se dá em
**dois lugares coordenados**:

1. **Artefato versionado** `etl/dados/cnes_enriquecimento_<lote>.csv` (ou `.json`) —
   fonte de verdade do casamento, auditável, revisável (§5.2).
2. **MongoDB (coleção `hospitais`)** — efeito material do artefato (§5.3).

### 5.2 Artefato de enriquecimento (esquema)

Uma linha por registro dos ~100, com:

| Coluna | Descrição |
|---|---|
| `import_key` | `importKey` atual do registro (chave de ligação) |
| `codigo_cnes` | CNES atribuído (vazio enquanto PENDING) |
| `nome_origem` | nome canônico do nosso registro |
| `nome_cnes_matched` | nome CNES que casou (fantasia ou razão social) |
| `categoria` | categoria do registro |
| `score_total` / `nome_sim` / `dist_m` | evidência do casamento |
| `tier` | `AUTO` \| `REVIEW` \| `PENDING` \| `MANUAL` (após revisão) |
| `motivo` | `null` p/ AUTO; motivo para REVIEW/PENDING (§6) |
| `revisado_por` / `revisado_em` | auditoria da revisão manual |

> O artefato é **versionado por lote** e versionável em git; reexecuções não sobrescrevem
> decisões humanas já registradas (`tier = MANUAL` é imutável pelo job automático).

### 5.3 Escrita no MongoDB

Para registros classificados **AUTO**:

- `$set { codigoCnes: <CNES> }`
- `$unset { importKey: "" }` (o fallback deixa de existir — evita duplicação futura)
- `$set { cnesFonte: "DATASUS", cnesScore: <score>, cnesOrigem: "ENRIQUECIMENTO_E1" }`

Para **REVIEW/PENDING**:

- manter `importKey`; `$set { cnesPendencia: <motivo> }` (visível para auditoria; **não**
  exposto na API pública sem decisão de spec).

### 5.4 Idempotência — regras obrigatórias

1. **Índice único `codigoCnes`** (já previsto, `sparse: true`) garante que nunca existirão
   dois registros com o mesmo CNES.
2. **Registro enriquecido perde `importKey`**; reexecuções do job de enriquecimento só
   alcançam registros que ainda têm `importKey` (idempotente por construção).
3. **Modificação obrigatória no `etl/importar_estabelecimentos.py`:** na montagem do
   documento, antes de decidir `codigoCnes` vs `importKey`, **consultar o artefato**:
   - se o `importKey` calculado existe no artefato com `tier ∈ {AUTO, MANUAL}` → gravar
     `codigoCnes` do artefato e **não** gravar `importKey`;
   - senão → manter o comportamento atual (`importKey`).
   Isso torna a reimportação dos CSVs originais idempotente mesmo depois do enriquecimento,
   eliminando a fragilidade do `importKey` apontada em `Pendencias-Epico-01.md` (item a).
4. **`codigoCnes` já preenchido** (240 registros) nunca é sobrescrito pelo enriquecimento.
5. **Rollback:** por `cnesFonte = "DATASUS"` (ou por lote) — desfazer `$set` e restaurar
   `importKey` a partir do artefato; nunca afeta registros de outros lotes.

> **Alternativa de implementação (a validar com a Bruna):** um **job dedicado**
> `etl/enriquecer_cnes.py` que roda **após** a importação (mesma stack Python + pymongo +
> rapidfuzz), em vez de embutir a lógica no importador. Recomendado: manter a consulta ao
> artefato no importador (regra 3) e concentrar o casamento no job dedicado. O artefato é o
> contrato entre os dois.

### 5.5 Sequência operacional

1. Preparar referência CNES (§3).
2. Rodar job de enriquecimento em **dry-run**: emitir artefato com `tier` e evidências, sem
   escrever no Mongo.
3. Revisão humana da fila REVIEW/PENDING (§6), registrando decisões no artefato.
4. **Apply**: gravar `codigoCnes` no Mongo para `AUTO` + `MANUAL` (após revisão).
5. Reimportar os CSVs originais (regressão): confirmar que os enriquecidos **não duplicam**
   (regra 3/4 de §5.4).

---

## 6. Revisão manual

### 6.1 Fila de revisão

Gerada a partir do artefato para todos os `tier ∈ {REVIEW, PENDING}`. Cada item traz:

- Identificação: `import_key`, `nome`, `categoria`, RA (`endereco.bairro`), endereço completo,
  coordenada.
- Top-3 candidatos CNES (CNES, nome fantasia/razão, logradouro+número, CEP, distância,
  `score_total`), com a evidência que levou ao `tier`.
- `motivo` do não-casamento automático.

### 6.2 Motivos padronizados (vocabulário fechado)

| `motivo` | Significado | Destino provável |
|---|---|---|
| `sem_correspondente_cnes` | nenhum candidato plausível no CNES | revisão humana decide (§6.3) |
| `ambiguo_top2` | dois candidatos com escore próximo | humano escolhe o correto |
| `conflito_endereco_geo` | nome casa, mas CEP/geo divergem | humano confirma ou descarta |
| `nao_e_estabelecimento` | equipe/serviço sem CNES próprio | mantém fallback; ver §6.3 |
| `dado_faltante_na_fonte` | CNES existe, mas ausente no CSV | humano preenche manualmente |

### 6.3 Tratamento dos "não-estabelecimentos"

As variantes UBS (prisional, saúde indígena, consultório na rua) são, em boa parte,
**equipes/serviços vinculados a uma UBS-base**, e não estabelecimentos físicos com CNES
próprio. A revisão deve distinguir:

- **Tem CNES (dado faltante):** atribuir o CNES real (ex.: a UBS-base correspondente).
- **Não tem CNES (equipe/serviço):** manter sem `codigoCnes`, marcando `motivo =
  nao_e_estabelecimento`. **Recomendação:** nesse caso, em vez do `importKey` frágil
  (nome+coord), adotar **chave estável derivada da UBS-base** (vínculo explícito), evitando
  duplicação em reimportações — decisão a registrar no artefato e alinhar com a Renata
  (emenda de spec se necessário).

### 6.4 Resolução e guardrails

- A decisão humana é gravada **no artefato** (`tier = MANUAL`, `revisado_por`, `revisado_em`),
  nunca apenas no banco.
- `MANUAL` **não é sobrescrito** por reexecuções do job automático.
- **Nunca descartar silenciosamente** um registro; todo destino é rastreável pelo artefato.
- Registros PENDING que continuem sem resolução **permanecem com `importKey`** e constam
  como débito em `Pendencias-Epico-01.md` até decisão do dono.

---

## 7. Definition of Ready (critérios de aceite)

- [ ] Referência CNES baixada, filtrada por `CO_UF=53` e normalizada (versionada).
- [ ] Tabela `TP_UNIDADE` → `categoria` validada contra o dicionário oficial e versionada.
- [ ] Calibração de limiares sobre amostra rotulada (~30) com revisão humana documentada.
- [ ] Artefato de enriquecimento gerado com 100% dos ~100 registros classificados
      (`AUTO`/`REVIEW`/`PENDING`) e evidência por registro.
- [ ] Todos os `AUTO` gravados com `codigoCnes` + `importKey` removido, sem colisão de índice.
- [ ] Fila REVIEW/PENDING revisada e resolvida (ou explicitamente mantida em pendência).
- [ ] Reimportação de regressão dos CSVs originais **não duplica** registros enriquecidos.
- [ ] Relatório de auditoria (validos/revisados/pendentes) em `Documentos/07-dados/`.

---

## 8. Handoff para a Bruna (escopo de implementação)

Esta entrega **não codifica**; especifica. A Bruna deve implementar:

1. **Extração:** download + recorte do CSV "Arquivos Totais Unidades" para `CO_UF=53`,
   normalização conforme §3.
2. **Tabela de mapeamento** `TP_UNIDADE` → `categoria` versionada (§3.3).
3. **Motor de casamento** com bloqueio por categoria + prefixo de nome/CEP, scoring ponderado
   (§4.6) usando `rapidfuzz`, e classificação em três níveis.
4. **Geração do artefato** `cnes_enriquecimento_<lote>.*` com o esquema de §5.2.
5. **Escrita no Mongo** (`$set codigoCnes` / `$unset importKey` / campos de auditoria), com
   `--dry-run` e `--apply`, e relatório em `Documentos/07-dados/`.
6. **Ajuste do `importar_estabelecimentos.py`** para consultar o artefato (§5.4 regra 3).
7. **Reconciliação opcional:** para os 240 com CNES, validar se `codigoCnes` existe na
   referência (relatório de divergências, sem alteração automática).
8. **Testes** (a especificar junto à Bruna): normalização (acentos, romanos, stopwords),
   bloqueio por categoria, scoring/limiares, idempotência (rodar 2× não duplica, reimportar
   não duplica), e tratamento de geo ausente no CNES.

---

## 9. Pendências e decisões aguardando o dono

| # | Pendência | Impacto |
|---|---|---|
| 1 | Confirmar disponibilidade/atualização do CSV "Arquivos Totais Unidades" | troca p/ PySUS/FTP se ausente |
| 2 | Validar códigos `TP_UNIDADE` (esp. CAPS=70, UPA=73) no dicionário oficial | bloqueio por categoria |
| 3 | Calibrar limiares (90/80/70, gap 15, 200 m) sobre amostra rotulada | precisão do AUTO |
| 4 | Decidir destino dos "não-estabelecimentos" (equipes) — chave estável vs `importKey` | emenda de spec c/ Renata |
| 5 | Aprovar campos de auditoria (`cnesFonte`, `cnesScore`, `cnesOrigem`, `cnesPendencia`) | contrato de API/spec |

---

*Fim — especificação técnica do enriquecimento CNES/DATASUS do Épico 01. Nenhuma linha de
código foi produzida; a codificação é de responsabilidade da Bruna (back-end), conforme
especificação acima. Atenção exclusiva ao Épico 01.*
