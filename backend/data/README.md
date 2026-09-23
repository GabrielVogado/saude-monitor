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

## Hospitais públicos complementares — `hospitais_publicos_complementares.json`

Fonte **separada** da rede pública acima: um extrato do **CNES/DATASUS** (competência
09/2026, filtro `CO_UF=53` e `TP_UNIDADE` hospitalar) com hospitais **PÚBLICOS** que o
CNES lista no DF mas que a fonte InfoSaúde/GDF (DBF/SHP) não traz — descoberto ao
verificar a cobertura da base contra a lista oficial de hospitais.

> ⚠️ **Escopo (decisão do PO, 08/09/2026): só hospitais públicos.** O mesmo
> levantamento CNES também classificou hospitais privados/filantrópicos do DF — essa
> parte **não é importada** (fica para uma versão futura). Este arquivo traz somente o
> subconjunto público; não existe campo `tipo` porque todo registro aqui é PÚBLICO por
> construção (ver `SeedMapper#montarPublicoComplementar`). O histórico completo da
> classificação privada/filantrópica (58 registros, já revertida) fica preservado no PR
> #103 (fechado, não mergeado) para quando a feature entrar em escopo.

Diferente do DBF/SHP, é **um único arquivo JSON** — o CNES já publica
`NU_LATITUDE`/`NU_LONGITUDE`, então não há geometria separada nem pareamento por ordem
de registro.

Formato (lido por `HospitalPublicoComplementarLeitor` → `SeedMapper#montarPublicoComplementar`):

```json
[
  {
    "nome": "INSTITUTO DE CARDIOLOGIA E TRANSPLANTES DO DISTRITO FEDERAL",
    "codigoCnes": "3276678",
    "logradouro": "ST SUDOESTE CRUZEIRO SUDOESTE OCTOGONAL",
    "numero": "S/N",
    "bairro": "CRUZEIRO NOVO",
    "cep": "70675731",
    "latitude": -15.801428,
    "longitude": -47.935961
  }
]
```

- `codigoCnes` é **obrigatório** — sem ele o registro é descartado (é a única chave de
  dedup disponível para esta fonte, não há coordenada de referência do DBF/SHP para gerar
  um `importKey`).
- Os demais campos chegam **brutos** (maiúsculas, sem formatação) — a mesma normalização
  de Title Case/CEP aplicada ao pipeline DBF/SHP (`EstabelecimentoNormalizador`) é
  aplicada aqui, então não há necessidade de pré-formatar o arquivo.
- Proveniência completa — os 21 candidatos públicos encontrados no CNES, quais já
  existiam na base sob sigla diferente (10), quais são federais/militares/temporários
  fora do escopo da rede SES-DF (10), e o único genuinamente ausente (1): ver o relatório
  em `Documentos/07-dados/`.

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
