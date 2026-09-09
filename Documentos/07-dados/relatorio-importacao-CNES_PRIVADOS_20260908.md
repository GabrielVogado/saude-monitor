# Relatório de importação — CNES_PRIVADOS_20260908

- **Objetivo:** completar a cobertura de hospitais do DF com a rede **privada e
  filantrópica**, ausente da fonte InfoSaúde/GDF hoje usada pelo seed (que cobre apenas a
  rede pública SES-DF — ver `backend/data/README.md`).
- **Fonte:** CNES/DATASUS, download público
  `cnes_estabelecimentos_csv.zip` (competência 09/2026).
- **Filtro geográfico:** `CO_UF = 53` (Distrito Federal).
- **Filtro de tipo:** `TP_UNIDADE` = `5` (Hospital Geral) ou `7` (Hospital Especializado) —
  confirmado empiricamente contra os hospitais do DF já conhecidos, não assumido do
  dicionário de dados.
- **Gerado em:** 2026-09-08.
- **Arquivo de saída:** `backend/data/estabelecimentos_privados.json` (lido por
  `EstabelecimentoPrivadoLeitor` → `SeedMapper#montarPrivado`).

## Resumo

| Métrica | Valor |
|---|---|
| Registros do DF no CNES | 12.550 |
| Hospitalares (`TP_UNIDADE` 5 ou 7) | 102 |
| Excluídos — já existem na base (duplicata por nome) | 6 |
| Excluídos — públicos fora do escopo desta importação | 21 |
| Excluídos — sem coordenada utilizável | 17 |
| **Importados (privados + filantrópicos)** | **58** |
| … dos quais PRIVADO | 54 |
| … dos quais FILANTROPICO | 4 |

## Por que não dá para confiar só em `CO_NATUREZA_JUR`

A primeira tentativa de classificar público vs. privado pelo dígito inicial de
`CO_NATUREZA_JUR` (`1xxx` = administração pública, `3xxx` = privado sem fins lucrativos)
classificou errado três estabelecimentos genuinamente públicos, porque fundações públicas
de direito privado usam código `3xxx` — igual a uma entidade filantrópica qualquer:

- **HOSPITAL DE BASE DO DISTRITO FEDERAL** (natjur 3077) — já existe na base.
- **HRSM** / Hospital Regional de Santa Maria (natjur 3077) — já existe na base.
- **INSTITUTO DE CARDIOLOGIA E TRANSPLANTES DO DISTRITO FEDERAL** (natjur 3069) — **não**
  existe na base (ver achado fora de escopo abaixo).

O erro foi detectado ao notar "Hospital de Base" — um dos 16 hospitais públicos já
confirmados no relatório de importação da rede InfoSaúde/GDF — aparecendo no lote
classificado como privado. Não havendo uma tabela oficial de códigos de natureza jurídica
confiável e completa disponível para consulta neste momento, a classificação final usa uma
combinação defensável em vez de adivinhar a tabela:

1. **Dedup por nome normalizado** contra os 340 registros já existentes na base (sem
   acento, minúsculas, pontuação colapsada) — critério objetivo, não uma suposição.
2. **Listas explícitas e pequenas de exceções verificadas manualmente**: fundações
   públicas conhecidas (Hospital de Base, HRSM), público fora de escopo (Instituto de
   Cardiologia — ver abaixo) e filantrópicas de rede nacional bem conhecidas (Sarah,
   Sírio-Libanês).
3. **`CO_NATUREZA_JUR` iniciado em `1`** (administração pública direta) tratado como
   público fora de escopo desta importação.
4. Todo o restante com natureza jurídica **comercial** (faixa `2xxx`, "Entidades
   Empresariais") é tratado como **PRIVADO com alta confiança**.
5. Natureza jurídica **`3999`** ("outras entidades sem fins lucrativos", um código
   residual/catch-all) é tratada como **FILANTROPICO com confiança BAIXA** — sinalizada
   abaixo para revisão manual, não afirmada como fato.

## Achado fora de escopo: hospital público não importado nem pela rede InfoSaúde/GDF

**INSTITUTO DE CARDIOLOGIA E TRANSPLANTES DO DISTRITO FEDERAL** (CNES no CNES, natjur
3069 — fundação pública) é um hospital público do GDF que **não aparece** na base atual
(340 registros, fonte InfoSaúde/GDF) e **não foi importado neste PR** — está fora do
escopo desta tarefa (hospitais privados/filantrópicos). Fica registrado aqui como achado
a ser tratado separadamente: a rede pública SES-DF pode ter uma lacuna real de cobertura.

Os demais 20 "públicos fora de escopo" (HRAN, HRG, HRT, HRS, Hospital Universitário de
Brasília, HRPL, Hospital Materno Infantil Dr. Antônio Lisboa, HRBZ, HFA, hospitais de
campanha COVID-19, HRL, HRSAM, Hospital Regional do Guará I, HMAB, hospitais militares
— Força Aérea e Marinha) são siglas/nomes que **já correspondem** a hospitais existentes
na base sob outro nome (ex.: sigla vs. nome por extenso) ou são estruturas
federais/militares fora do escopo da rede SES-DF; não foram investigados individualmente
porque não é o objetivo desta importação (rede privada/filantrópica).

## Classificações com confiança baixa (revisar manualmente)

| Nome | CNES | Motivo da confiança baixa |
|---|---|---|
| HOSPITAL SÃO MATEUS | 6730914 | `CO_NATUREZA_JUR = 3999` (catch-all "outras entidades sem fins lucrativos") — pode ser privado comercial mal codificado no CNES, não necessariamente filantrópico |
| COMUNIDADE TERAPÊUTICA ESPERANÇA | 9928553 | idem — natjur `3999`; comunidades terapêuticas variam bastante entre filantrópicas e privadas |

Ambos foram importados como `FILANTROPICO` (é a classificação mais provável dado o
padrão observado), mas ficam sinalizados aqui para quem tiver acesso a uma fonte mais
específica (ex.: consulta individual ao CNES web) confirmar.

## Exclusões — duplicatas (já existem na base, por nome)

HOSPITAL DE BASE DO DISTRITO FEDERAL · HOSPITAL REGIONAL DE CEILÂNDIA · HOSPITAL SÃO
VICENTE DE PAULO (HSVP) · HOSPITAL DE APOIO DE BRASÍLIA (HAB) · HRSM · HOSPITAL DA
CRIANÇA DE BRASÍLIA JOSÉ ALENCAR (HCB)

## Exclusões — sem coordenada utilizável no CNES (17)

HOSPITAL UNIMED TAGUATINGA · CLÍNICA DE REPOUSO DO PLANALTO S.A. · ISOB · HOSPITAL SÃO
LUCAS · HOSPITAL SÃO BRAZ · PAI PRONTO ATENDIMENTO INFANTIL · INBOL · SER CLÍNICA DE
SAÚDE MENTAL · NEOBRAS UTI NEONATAL E PEDIÁTRICA · HOSPITAL UNIMED ASA SUL · ORTOSUL
CENTRO DE ORTOPEDIA E FRATURAS LTDA · CIRPLAS · HOSPITAL UNIMED 914 SUL · HOSPITAL DO
CORAÇÃO DO BRASIL · CENTRO CLÍNICO ANANKE · INSTITUTO CAPITAL BRASIL MEDICINA
ESPECIALIZADA · MANSÃO VIDA

Estes ficam de fora desta importação porque não há geometria de referência alternativa
(diferente do pipeline DBF/SHP da rede pública, esta fonte depende inteiramente da
coordenada que o próprio CNES publica).

## Como reproduzir

O script de classificação (`montar_privados.py`, mantido fora do repositório —
scratchpad de sessão, não versionado) parte de dois insumos: um extrato do CNES filtrado
por `CO_UF=53` (`cnes_df.json`) e os 340 registros já publicados pela API (`page_0..3.json`,
paginação de `GET /api/v1/hospitais`) para o dedup por nome. Qualquer reprocessamento
futuro deve repetir os mesmos três filtros (UF, tipo hospitalar, dedup por nome) e revisar
manualmente qualquer novo `CO_NATUREZA_JUR = 3999` encontrado, em vez de assumir a
classificação anterior.
