# Relatório de Auditoria — Épico 01 (Campos, Categorias e CNES)

> **Data:** 21/08/2026 · **Executor:** Arquiteto Gabriel · **Escopo:** `hospitais` (340 registros)
> **Mudanças:** campos de serviço, categorias por camada e auditoria de coerência de CNES.

---

## 1. Resumo

| Métrica | Antes | Depois |
|---|---|---|
| Total de registros | 340 | **340** |
| Registros com `codigoCnes` | 300 | **300** |
| Registros com `importKey` (sem CNES) | 40 | **40** |
| Campos de serviço | 0 | **adicionados** (ver §3) |

---

## 2. Distribuição por categoria

| Categoria | Qtd | Origem (camada) |
|---|---|---|
| HOSPITAL | 16 | Hospitais |
| UPA | 13 | Unidades_de_Pronto_Atendi |
| UBS | 206 | Unidade_Básica_de_Saúde (183) + UBS prisionais (9) + indígena (7) + consultório na rua (7) |
| **POLICLINICA** | **18** | Policlínicas (era OUTRO) |
| **CAPS** | **18** | Centros_de_Atenção_Psicos (era OUTRO) |
| **CENTRO_ESPECIALIZADO** | **40** | Centros_Especializados (era OUTRO) |
| OUTRO | 29 | Outras_Unidades_de_Saúde |

- **76 categorias corrigidas** (OUTRO → POLICLINICA/CAPS/CENTRO_ESPECIALIZADO).
- OUTRO residual (29) = "Outras Unidades", agora com `tipoUnidade` para subdivisão.

---

## 3. Campos de serviço importados

| Campo | Tipo | Preenchidos | Fonte |
|---|---|---|---|
| `horarioFuncionamento` | string | **208** | UBS (183) + Policlínicas (18) + UBS indígena (7) |
| `salaVacina` | bool | **183** (152 SIM / 31 NÃO) | UBS |
| `farmacia` | bool | **183** (122 SIM / 61 NÃO) | UBS |
| `coletaMaterial` | bool | **183** (147 SIM / 36 NÃO) | UBS |
| `tipoUnidade` | string | **69** | Centros_Especializados (40) + Outras_Unidades (29) |

---

## 4. Auditoria de CNES (coerência)

Metodologia: pareamento **fonte (.dbf/CSV) × banco × DATASUS** por CNES e por coordenada.

| Verificação | Resultado |
|---|---|
| CNES da fonte (`.dbf`) presentes no banco | **240/240** ✅ |
| Trocas nome↔CNES (CNES associado ao estabelecimento errado) | **0** ✅ |
| CNES no banco que não vêm da fonte | 60 (preenchidos via DATASUS) |
| CNES no banco ausentes do DATASUS (`cnes_df.csv`, 12.500 registros) | **0** ✅ |
| Registros sem CNES (importKey) | 40 |

**Conclusão da auditoria:** **nenhuma incoerência de CNES encontrada.** Os 240 CNES
existentes no `.dbf` estão íntegros e associados aos estabelecimentos corretos; os 60
adicionais vieram do enriquecimento DATASUS (preenchem lacunas do `.dbf`), todos válidos
na base oficial. Nenhuma correção de CNES foi necessária.

### Nota sobre "divergentes" aparentes

A primeira varredura (pareamento por coordenada) sinalizou 5 divergências. Análise
detalhada confirmou que são **colisões de coordenadas** — dois estabelecimentos distintos
no mesmo ponto (ex.: "UBS 01 Riacho Fundo I" e "UBS 03 Riacho Fundo II"; "Hospital
Regional do Gama" e "Cepav - Gardênia"). Cada CNES aponta para o estabelecimento correto:
**0 trocas reais**.

---

## 5. `importKey` recalculados

17 registros sem CNES mudaram de categoria (OUTRO → CENTRO_ESPECIALIZADO). Como o
`importKey` é `sha256(categoria + nome + coordenada)`, esses 17 tiveram a chave
recalculada para refletir a nova categoria. Os demais 23 sem CNES (UBS indígenas/
prisionais/consultório) permaneceram UBS, sem alteração de chave.

---

## 6. Arquivos alterados

**Backend (Spring Boot / Gradle)**
- `CategoriaEstabelecimento.java` — +POLICLINICA, CAPS, CENTRO_ESPECIALIZADO
- `HospitalDocument.java` — +horarioFuncionamento, salaVacina, farmacia, coletaMaterial, tipoUnidade
- `HospitalResponse.java` — +5 campos
- `HospitalServiceImpl.java` — mapeamento dos novos campos
- `HospitalControllerTest.java` — stub atualizado
- Compilação e testes: **BUILD SUCCESSFUL**

**ETL (Python)**
- `importar_estabelecimentos.py` — categorias por camada, campos novos, raios, `sim_nao_para_bool`
- `migrar_campos_categorias.py` — migração idempotente dos 340 documentos (nova)
- `README.md` — atualizado

---

*Sem commit/push no git, conforme orientação. Banco local alterado.*
