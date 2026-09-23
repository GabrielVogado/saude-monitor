# Relatório de importação — CNES_PUBLICOS_COMPLEMENTARES_20260909

- **Objetivo:** verificar se a base de hospitais (fonte InfoSaúde/GDF, DBF/SHP) cobre
  todos os hospitais **públicos** do DF, cruzando contra o CNES/DATASUS.
- **Fonte:** CNES/DATASUS, download público `cnes_estabelecimentos_csv.zip`
  (competência 09/2026).
- **Filtro geográfico:** `CO_UF = 53` (Distrito Federal).
- **Filtro de tipo:** `TP_UNIDADE` = `5` (Hospital Geral) ou `7` (Hospital Especializado).
- **Gerado em:** 2026-09-09 (corrige e substitui o relatório de 08/09/2026 — ver
  "Correção de escopo" abaixo).
- **Arquivo de saída:** `backend/data/hospitais_publicos_complementares.json` (lido por
  `HospitalPublicoComplementarLeitor` → `SeedMapper#montarPublicoComplementar`).

## Correção de escopo (08→09/09/2026)

A primeira versão deste trabalho (08/09/2026, PR #103, **fechado sem merge**) classificou
o mesmo extrato CNES em PRIVADO/FILANTROPICO e propôs importar 58 hospitais. O PO
esclareceu que **hospitais privados/filantrópicos ficam para uma versão futura** — hoje a
base trabalha exclusivamente com hospitais públicos. O PR foi fechado e a classificação
privada/filantrópica não é usada; fica preservada no histórico do PR #103 para quando a
feature entrar em escopo.

Reaproveitando a mesma extração/normalização/dedup (não descartando o trabalho already
feito), este relatório repete o cruzamento com um objetivo diferente: dos 102 registros
hospitalares do CNES no DF, quantos são **hospitais públicos que a nossa base ainda não
tem** — e não quantos são privados.

## Resumo

| Métrica | Valor |
|---|---|
| Registros do DF no CNES | 12.550 |
| Hospitalares (`TP_UNIDADE` 5 ou 7) | 102 |
| Já existem na base — nome bateu direto na primeira passada | 6 |
| Já existem na base — mesmo hospital sob sigla/nome diferente (verificado nesta correção) | 10 |
| Público, fora do escopo da rede SES-DF (federal/militar/temporário — não importado) | 10 |
| **Público, genuinamente ausente da base (importado)** | **1** |
| Sem coordenada utilizável no CNES (eram candidatos privados/filantrópicos — fora de escopo de qualquer forma) | 17 |
| Privado/filantrópico (fora de escopo por decisão do PO — não importado; classificação preservada no PR #103) | 58 |

(6 + 10 + 10 + 1 + 17 + 58 = 102.)

## Os 21 candidatos "público, não bateu por nome" — verificados um a um

A primeira passada (08/09) encontrou 21 registros classificados como público mas que não
batiam por nome normalizado contra os 340 registros existentes — e não investigou cada um
individualmente, porque não era o objetivo daquela importação (privados). Como agora **é**
o objetivo, cada um foi verificado contra a razão social e o endereço do próprio CNES:

| CNES | Nome no CNES (`NO_FANTASIA`) | Razão social | Veredito |
|---|---|---|---|
| 10464 | HRAN | Hospital Regional da Asa Norte | Já existe — nosso "Hospital Regional da Asa Norte" |
| 10472 | HRG | Hospital Regional do Gama | Já existe — nosso "Hospital Regional do Gama" |
| 10499 | HRT Hospital Regional de Taguatinga | Hospital Regional de Taguatinga | Já existe — nosso "Hospital Regional de Taguatinga" |
| 10502 | HRS | Hospital Regional de Sobradinho | Já existe — nosso "Hospital Regional de Sobradinho" |
| 10529 | HRPL | Hospital Regional de Planaltina | Já existe — nosso "Hospital Regional de Planaltina" |
| 10545 | HRBZ | Hospital Regional de Brazlândia | Já existe — nosso "Hospital Regional de Brazlândia" |
| 2672197 | HRSAM Hospital Regional de Samambaia | Hospital Regional de Samambaia | Já existe — nosso "Hospital Regional de Samambaia" |
| 2645157 | HRL | Hospital da Região Leste | Já existe — nosso "Hospital Regional da Região Leste" |
| 2814897 | Hospital Regional do Guará I | Distrito Federal Secretaria de Saúde | Já existe — nosso "Hospital Regional do Guará" |
| 10537 | Hospital Materno Infantil Dr. Antônio Lisboa | idem | Já existe — nosso "Hospital Materno Infantil de Brasília (HMIB)" — HMIB é justamente essa razão social por extenso |
| 10510 | Hospital Universitário de Brasília | Fundação Universidade de Brasília | Fora de escopo — hospital **federal** (EBSERH/UnB), nunca foi rede SES-DF |
| 10561 | HFA | Hospital das Forças Armadas | Fora de escopo — hospital militar tri-força federal |
| 5927579 | Hospital de Força Aérea de Brasília (HFAB) | Comando da Aeronáutica | Fora de escopo — hospital militar federal |
| 6362729 | Hospital Naval de Brasília | Comando da Marinha | Fora de escopo — hospital militar federal |
| 7161158 | HMAB | Hospital Militar de Área de Brasília | Fora de escopo — hospital militar federal (Exército) |
| 174971 | Hospital de Campanha COVID-19 | Hospital de Campanha COVID-19 Estádio Mané Garrincha | Fora de escopo — estrutura temporária de pandemia |
| 252492 | Hospital de Campanha do Centro Médico da PM | idem | Fora de escopo — estrutura temporária de pandemia |
| 734403 | Hospital de Campanha COVID-19 Gama | idem | Fora de escopo — estrutura temporária de pandemia |
| 755834 | Hospital de Campanha COVID-19 Autódromo | idem | Fora de escopo — estrutura temporária de pandemia |
| 766216 | Hospital de Campanha COVID-19 Ceilândia | idem | Fora de escopo — estrutura temporária de pandemia |
| **3276678** | **Instituto de Cardiologia e Transplantes do Distrito Federal** | Fundação Universitária de Cardiologia | **✅ Genuinamente ausente — importado** |

Critério de "fora de escopo": hospital público, mas administrado por uma esfera federal
(universidade, forças armadas) ou uma estrutura temporária de pandemia — nunca fez parte
da rede SES-DF que a fonte InfoSaúde/GDF (e, por extensão, este produto) cobre.

## O hospital importado

**Instituto de Cardiologia e Transplantes do Distrito Federal** (CNES 3276678) —
`TP_GESTAO=E` (gestão estadual), `DS_ESFERA_ADMINISTRATIVA=ESTADUAL`,
`CO_AMBULATORIAL_SUS=SIM`: um hospital público do GDF (Cruzeiro Novo), fundação
universitária de direito público — mesmo padrão jurídico do Hospital de Base e do HRSM,
que também usam `CO_NATUREZA_JUR` na faixa `3xxx` apesar de serem públicos (ver a nota
sobre `CO_NATUREZA_JUR` abaixo). Ambulatório e internação SUS confirmados.

## Por que não dá para confiar só em `CO_NATUREZA_JUR`

`CO_NATUREZA_JUR` iniciado em `1` (administração pública direta) identificou corretamente
todos os 20 hospitais "já existem"/"fora de escopo" federais/militares desta tabela — sinal
confiável para esses casos. Mas fundações públicas de direito privado (Hospital de Base,
HRSM, e agora o Instituto de Cardiologia) usam códigos que começam em `3`, a mesma faixa
de entidades privadas sem fins lucrativos — por isso a classificação final não usa o dígito
isoladamente, e sim razão social + esfera administrativa + confronto manual contra a lista
de hospitais já conhecidos.

## Como reproduzir

Mesmos três filtros da extração original (UF, tipo hospitalar, dedup por nome), mais a
verificação individual de razão social/endereço para qualquer candidato que não bata por
nome normalizado — não presumir "fora de escopo" ou "já existe" sem essa checagem, foi
exatamente o passo que faltou na primeira versão.
