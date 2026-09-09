# Seed de estabelecimentos — `backend/data/`

Esta pasta contém os arquivos-fonte do **seed automático** que popula a coleção
`hospitais` no MongoDB quando o backend sobe pela primeira vez (Épico 01).

## O que colocar aqui

Para cada **camada de estabelecimento**, dois arquivos são necessários:

| Arquivo | Conteúdo | Obrigatório |
|---|---|---|
| `<Camada>.dbf` | Atributos (nome, CNES, horário, sala de vacina, farmácia, coleta, tipo, endereço, CEP, RA) | ✅ sim |
| `<Camada>.shp` | **Geometria** — as coordenadas lat/lon de cada ponto | ✅ sim |
| `<Camada>.shx` | Índice do shapefile | ❌ não (o seed lê `.shp` e `.dbf` diretamente) |
| `<Camada>.prj` / `.cpg` | Projeção / codepage | ❌ não (projeção fixa WGS84; codepage via `app.seed.codepage`) |

> ⚠️ **O `.dbf` sozinho NÃO é suficiente.** As coordenadas (`localizacao` e `geofence`,
> indexadas com 2dsphere) vivem apenas no `.shp`. Sem o `.shp`, o seed descarta o registro.

## Camadas esperadas (estabelecimentos)

O seed ignora camadas de **limite/região** (não são estabelecimentos):

- ❌ Macrorregiões_de_Saúde, Região_Integrada_de_Desen, Regiões_Administrativas, Regiões_de_Saúde

Camadas de estabelecimento processadas (stem do arquivo → categoria):

| Stem (nome do arquivo) | Categoria |
|---|---|
| `Hospitais` | HOSPITAL |
| `Unidades_de_Pronto_Atendi` | UPA |
| `Unidade_Básica_de_Saúde` | UBS |
| `UBS_-_Unidades_Prisionais` | UBS |
| `UBS_-_Saúde_Indígena` | UBS |
| `UBS_-_Consultório_na_rua` | UBS |
| `Policlínicas` | POLICLINICA |
| `Centros_de_Atenção_Psicos` | CAPS |
| `Centros_Especializados` | CENTRO_ESPECIALIZADO |
| `Outras_Unidades_de_Saúde` | OUTRO |

O pareamento entre o `.dbf` e o `.shp` é feito **por ordem de registro** (1 DBF ⇄ 1 ponto SHP),
o mesmo contrato do pipeline ETL de referência.

## Hospitais privados/filantrópicos — `estabelecimentos_privados.json`

Fonte **separada** da rede pública acima: um extrato do **CNES/DATASUS** (competência
09/2026, filtro `CO_UF=53` e `TP_UNIDADE` hospitalar) com os hospitais privados e
filantrópicos do Distrito Federal que não fazem parte da rede SES-DF. Diferente do
DBF/SHP, é **um único arquivo JSON** — o CNES já publica `NU_LATITUDE`/`NU_LONGITUDE`,
então não há geometria separada nem pareamento por ordem de registro.

Formato (lido por `EstabelecimentoPrivadoLeitor` → `SeedMapper#montarPrivado`):

```json
[
  {
    "nome": "HOSPITAL AGUAS CLARAS",
    "tipo": "PRIVADO",
    "codigoCnes": "49867",
    "logradouro": "R ARARIBA LOTE 03 E",
    "numero": "05",
    "bairro": "AGUAS CLARAS",
    "cep": "71927360",
    "latitude": -15.845841,
    "longitude": -48.031202
  }
]
```

- `tipo`: `"PRIVADO"` ou `"FILANTROPICO"` (nunca `"PUBLICO"` — registros públicos
  encontrados no CNES que não estejam na rede SES-DF são um achado à parte, não entram
  neste arquivo; ver o relatório de importação).
- `codigoCnes` é **obrigatório** — sem ele o registro é descartado (é a única chave de
  dedup disponível para esta fonte, não há coordenada de referência do DBF/SHP para gerar
  um `importKey`).
- Os demais campos chegam **brutos** (maiúsculas, sem formatação) — a mesma normalização
  de Title Case/CEP aplicada ao pipeline DBF/SHP (`EstabelecimentoNormalizador`) é
  aplicada aqui, então não há necessidade de pré-formatar o arquivo.
- Proveniência completa, critérios de classificação público/privado/filantrópico, exclusões
  por duplicata e achados fora de escopo: ver o relatório em `Documentos/07-dados/`.

## Como o seed é controlado

Configuração em `application.properties` (prefixo `app.seed`):

- `app.seed.enabled=true` — habilita/desabilita o seed por ambiente.
- `app.seed.path=data/` — diretório dos arquivos (relativo ao working dir; `/app/data` no Docker).
- `app.seed.modo=skip-if-not-empty` — só semeia se a coleção estiver **vazia** (primeiro boot).
  Use `upsert` para re-importar fazendo upsert por `codigoCnes`/`importKey`.
- `app.seed.codepage=UTF-8` — codificação dos `.dbf`.
- `app.seed.raio-*` — raio do geofence circular por categoria (metros).

## Observações

- O seed é **idempotente**: no modo padrão, não faz nada se a coleção já tiver dados;
  no modo `upsert`, re-grava preservando `id` e `criadoEm`.
- O **enriquecimento DATASUS/CNES** é um passo separado e posterior; o seed importa os
  dados **brutos** do `.dbf`/`.shp`. Não rode `app.seed.modo=upsert` sobre um banco já
  enriquecido, pois registros sem CNES na fonte podem duplicar.
