# Relatório de Enriquecimento CNES — registros sem CNES (Épico 01)

- **Data:** 2026-08-20
- **Fonte CNES:** DATASUS / dadosabertos.saude.gov.br (CNES Estabelecimentos, competência 07/2026, UF=DF)
- **Base alvo:** coleção `hospitais` (340 registros; 100 sem CNES usando `importKey`)

## Resumo

| Métrica | Qtd |
|---|---|
| Registros sem CNES analisados | 100 |
| **Reimportados (codigoCnes gravado, importKey removido)** | **60** |
| Duplicados de registro existente (CNES já na base) | 17 |
| Duplicados internos (mesmo CNES entre os 100) | 15 |
| Não casados (revisão manual) | 7 |
| Ambíguos (revisão manual) | 1 |

**Taxa de casamento:** 92/100 (92%) com CNES identificado; 60/100 (60%) reimportados com CNES definitivo único.

## Por categoria (reimportados / total sem CNES)

| Categoria | Reimportados | Duplicados | Não casados/ambíguos | Total |
|---|---|---|---|---|
| HOSPITAL | 16 | 0 | 0 | 16 |
| UPA | 13 | 0 | 0 | 13 |
| UBS | 0 | 22 | 1 | 23 |
| OUTRO | 31 | 10 | 7 | 48 |

## Metodologia de casamento (parâmetros documentados)

1. **Fonte:** CSV `cnes_estabelecimentos` do Portal de Dados Abertos do SUS (s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/CNES), filtrado para UF=53 (DF), 12.500 registros.
2. **Normalização canônica de nome:** minúsculas, sem acento (NFD), sem pontuação, espaços colapsados.
3. **Score de nome:** `max(fuzz.ratio, fuzz.token_sort_ratio)` de rapidfuzz sobre (nome fantasia, razão social) — `ratio` puro evita o artefato ~85.5 do `WRatio` e a inflação do `token_set_ratio` para "UPA II" vs "UPA".
4. **Evidência de localização:** distância geodésica (haversine) entre o ponto do registro (shapefile) e a lat/long do CNES; CEP exato; similaridade de logradouro e bairro.
5. **Decisão:** nome ≥ 92 → casado; senão, combinação (nome + geo + CEP + bairro + logradouro) com limiares 130/110; nome < 45 e loose < 60 → não casado.
6. **Colisão de CNES:** se ≥2 registros casam o mesmo CNES, mantém o de maior score e marca os demais como duplicados (respeita o índice único `codigoCnes`).
7. **Correções manuais (8):** casos com numeral/abreviação ambíguos verificados um a um na base CNES (ex.: "Upa São Sebastião"→7116756, "Caps Ad III Ceilândia"→6585760, "Ubs 6 Paranoá"→2804107).

## Não casados / ambíguos (revisão manual)

| Registro | Categoria | Motivo |
|---|---|---|
| Cepav - Caliandra | OUTRO | CEPAV renomeado/consolidado — sem CNES correspondente |
| Cepav - Violeta | OUTRO | CEPAV renomeado/consolidado — sem CNES correspondente |
| Cepav - Jasmim | OUTRO | CEPAV renomeado/consolidado — sem CNES correspondente |
| Ubs Sia | UBS | ambiguidade (UBS SIA CPP vs UBS prisional) — revisar |
| Cepav - Alegrim | OUTRO | CEPAV renomeado/consolidado — sem CNES correspondente |
| Cepav - Jardim | OUTRO | CEPAV renomeado/consolidado — sem CNES correspondente |
| Ambulatório de Diversidade de Gênero – Ambulatório Trans | OUTRO | sem correspondência confiável |
| Cepav - Margarida | OUTRO | CEPAV renomeado/consolidado — sem CNES correspondente |

## Duplicados de registro existente (CNES já na base)

Registros que casaram com um CNES já presente em outro documento da coleção (a fonte tem camadas sobrepostas — o mesmo estabelecimento aparece com CNES numa camada e sem CNES em outra).

- UBS · Ubs 6 - Paranoá → 2804107 (UBS 6 CARIRU PARANOA)
- UBS · Ubs 1 - Paranoá → 0010634 (UBS 1 PARANOA)
- UBS · Ubs Gama → 7843135 (UBS 16 ATP GAMA)
- UBS · Ubs 2 - Asa Norte → 0010723 (UBS 2 ASA NORTE)
- OUTRO · Cesmu - Centro Especializado em Saúde da Mulher → 9580816 (CESMU)
- UBS · Ubs 5 - Taguatinga → 0010626 (UBS 05 TAGUATINGA)
- UBS · Ubs 1 - São Sebastião → 0010790 (UBS 1 SAO SEBASTIAO)
- UBS · Ubs 1 - Sobradinho → 0011223 (UBS 1 SOBRADINHO)
- UBS · Ubs Plano Piloto → 0263680 (UBS 01 DCCP)
- UBS · Ubs 2 - Itapoã → 3286959 (UBS 2 ITAPOA)
- UBS · Ubs 1 - Núcleo Bandeirante → 0011126 (UBS 01 NUCLEO BANDEIRANTE)
- UBS · Ubs 1 - Asa Sul → 0011150 (UBS 1 ASA SUL)
- UBS · Ubs 5 - Ceilândia → 0011010 (UBS 5 CEILANDIA)
- UBS · Ubs 4 - Gama → 0010855 (UBS 4 GAMA)
- OUTRO · Ceo Unidade Básica de Saúde Nº 11 de Ceilândia → 0011061 (UBS 11 CEILANDIA)
- UBS · Ubs Gama → 3027635 (UBS 15 PFDF GAMA)
- UBS · Ubs 9 - Samambaia → 3742857 (UBS 09 SAMAMBAIA)

## Duplicados internos (mesmo CNES entre os 100)

- OUTRO · Ceo Hospital Materno Infantil de Brasília (hmib) → 0010537 (HOSPITAL MATERNO INFANTIL DR ANTONIO LISBOA)
- OUTRO · Ceo Hospital Regional de Taguatinga (hrt) → 0010499 (HRT HOSPITAL REGIONAL DE TAGUATINGA)
- UBS · Ubs São Sebastião → 0010790 (UBS 1 SAO SEBASTIAO)
- OUTRO · Ceo Hospital Regional do Gama (hrg) → 0010472 (HRG)
- UBS · Ubs São Sebastião → 0010790 (UBS 1 SAO SEBASTIAO)
- OUTRO · Ceo Hospital Regional da Asa Norte (hran) → 0010464 (HRAN)
- OUTRO · Ceo Hospital Regional de Sobradinho (hrs) → 0010502 (HRS)
- OUTRO · Ceo Hospital Regional de Santa Maria (hrsm) → 5717515 (HRSM)
- OUTRO · Ceo Hospital Regional Leste (hrl) → 2645157 (HRL)
- UBS · Ubs 3 - São Sebastião → 0010790 (UBS 1 SAO SEBASTIAO)
- UBS · Ubs 2 - Asa Norte → 0010723 (UBS 2 ASA NORTE)
- UBS · Ubs São Sebastião → 0010790 (UBS 1 SAO SEBASTIAO)
- UBS · Ubs São Sebastião → 0010790 (UBS 1 SAO SEBASTIAO)
- OUTRO · Ceo Hospital Regional de Planaltina (hrpl) → 0010529 (HRPL)
- UBS · Ubs São Sebastião → 0010790 (UBS 1 SAO SEBASTIAO)

*Gerado automaticamente pelo pipeline de enriquecimento CNES (Épico 01).*
