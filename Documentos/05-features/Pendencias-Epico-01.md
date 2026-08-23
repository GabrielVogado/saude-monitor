# Pendências — Épico 01 (Importação de Estabelecimentos de Saúde)

> **Feature atrelada:** Épico 01 — Cadastro de Hospitais e Geofences
> **Responsável técnico:** Gabriel Vogado
> **Data:** 20/08/2026
> **Contexto:** importação dos 14 CSVs de atributos (`multiplas_camadas_saude_14_csv`)
> combinados com a geometria dos shapefiles (`multiplas_camadas_saude_14`).

Esta seção registra os débitos e pendências da importação que **não foram totalmente
resolvidos** e que exigem acompanhamento ou decisão do dono do produto/arquitetura.

---

## (a) Registros sem CNES — enriquecimento via CNES/DATASUS

**Status:** ✅ RESOLVIDO em grande parte (enriquecimento com o CNES oficial do DATASUS).

De 340 registros importados, **100 (29,4%) não possuíam CNES** e dependiam do fallback
`importKey`. Foi executado um enriquecimento contra a base **CNES Estabelecimentos do
DATASUS** (Portal de Dados Abertos do SUS, competência 07/2026, UF=DF — 12.500 registros),
com casamento fuzzy (nome + geolocalização + CEP + logradouro/bairro). Resultado:

| Desfecho | Qtd | Observação |
|---|---|---|
| **Reimportados** (`codigoCnes` gravado, `importKey` removido) | **60** | CNES definitivo único |
| Duplicados de registro existente (CNES já na base) | 17 | camadas sobrepostas (ver abaixo) |
| Duplicados internos (mesmo CNES entre os 100) | 15 | 8 "CEO hospitalar" = hospital; 7 UBS prisionais/Papuda |
| Não casados (revisão manual) | 7 | 6 CEPAV renomeados + Ambulatório Trans |
| Ambíguos (revisão manual) | 1 | UBS SIA |

**Taxa de sucesso:** 92/100 (92%) dos registros tiveram CNES identificado;
**60/100 (60%)** reimportados com CNES definitivo único. Por categoria: HOSPITAL 16/16,
UPA 13/13, OUTRO 31/48 reimportados.

**Estado final da coleção `hospitais`:** `codigoCnes` = 300 · `importKey` = 40.

**Achados relevantes (decisão do dono do produto):**

1. **Camadas UBS rotuladas erradas na fonte.** As camadas `UBS_-_Saúde_Indígena` e
   `UBS_-_Consultório_na_rua` contêm, na verdade, **UBS regulares** que **duplicam**
   a camada `Unidade_Básica_de_Saúde` (que já tem CNES). São 14 UBS duplicadas
   (ex.: "UBS 1 Paranoá", "UBS 5 Taguatinga") — daí os 17 "duplicados de registro
   existente". Recomenda-se excluir essas duas camadas da importação (ou validar o
   rótulo com o produtor dos dados).
2. **CEPAV renomeados/consolidados.** 6 unidades "Cepav - <flor>" (Caliandra, Violeta,
   Jasmim, Alegrim, Jardim, Margarida) não têm CNES correspondente — foram renomeadas
   ou consolidadas em CEPAVs regionais (ex.: "CEPAV Flores da Central" no HRAN). As
   demais flores casaram (Amarílis, Alfazema).
3. **"CEO hospitalar" é duplicado do hospital.** 8 registros "Ceo Hospital Regional X"
   casaram com o CNES do próprio hospital (o CEO odontológico não tem CNES próprio na
   base do DATASUS); 1 (Ceilândia) tem CNES próprio ("CEO HRC" = 9676473). Confirmar
   tratamento: manter como duplicado ou mapear o CEO específico.
4. **UBS prisionais (Complexo da Papuda) duplicadas na fonte.** 5 registros "UBS São
   Sebastião" apontam para o mesmo endereço (Fazenda Papuda) e casaram com a mesma
   UBS prisional — a fonte traz o mesmo ponto repetido.
5. **Fragilidade do `importKey` (residual):** 40 registros ainda dependem de
   `importKey` (17 duplicados de camada + 15 duplicados internos + 8 não casados).
   Revisar antes do congelamento da chave de dedup.

---

## (b) Ausência de coordenadas nos CSVs — geometria vem do shapefile

**Status:** contornado (pareamento por ordem de registro).

- **Nenhum** CSV possui colunas de latitude/longitude. A geometria (pontos WGS84/
  EPSG:4326) vem **exclusivamente** dos `.shp`.
- O pareamento é feito **por ordem de registro** (1ª linha do CSV ⇄ 1º ponto do .shp).
  Verificado: contagens 1:1 em todas as 10 camadas e nomes idênticos entre `.dbf`
  e CSV (0 divergências na amostra de camadas sem CNES).

**Risco:** o pareamento por ordem é frágil — se a geração dos shapefiles reordenar
os registros no futuro, o alinhamento quebra silenciosamente. Recomenda-se migrar
para um pareamento por **chave comum** (ex.: nome normalizado + endereço) assim que
possível.

---

## (c) Débitos técnicos adicionais

| # | Débito | Impacto | Ação sugerida |
|---|---|---|---|
| 1 | 9 registros UBS com `"Nº"` corrompido (U+FFFD) no endereço | dado degradado na fonte | corrigido no ETL (`N�` → `Nº`); fonte original segue corrompida |
| 2 | Encoding inconsistente em `Regiões_de_Saúde.csv` (`Macrorregiāo` vs `Macrorregião`) | camada de limite (fora da coleção `hospitais`) | revisar na exportação das camadas de região |
| 3 | Nomes em Title Case degradam numerais romanos (`UNIDADE III` → `Unidade Iii`) | qualidade de exibição | adicionar exceção de romanos na normalização de nome |
| 4 | `ImportadorEstabelecimentos` (Java) lê CSV com lat/long e **não** suporta shapefile | divergência com o pipeline Python | alinhar ou descontinuar o importer Java |

---

## (d) Divergências de nomenclatura vs spec v2.0 (apontadas pela Renata)

Ajustes de contrato pendentes para alinhar o código ao `Especificacao-API-v2.0.md`:

| # | Local (código) | Atual | Spec v2.0 | Referência |
|---|---|---|---|---|
| 1 | `LoginRequest` — campo de senha | `password` | `senha` | §3.1 `POST /api/v1/auth/login` |
| 2 | `UserDocument` — coleção MongoDB | `users` | `usuarios` | §2.2 modelo `usuarios` |

**Impacto:** qualquer cliente que siga o contrato publicado (campo `senha`) quebra contra o
payload atual (`password`). A coleção `users` diverge do contrato `usuarios` — alinhar antes
do congelamento do contrato (Sprint 0 / F0).

---

## Bloqueios que exigem decisão

1. **Obter CNES oficial** para os ~100 registros sem CNES — ✅ **concluído em 60/100**
   (reimportados com CNES definitivo). Restam 40 registros dependendo de `importKey`
   (17 duplicados de camada + 15 duplicados internos + 8 sem correspondência) — ver §(a).
2. **Confirmar o pareamento por ordem** como estratégia aceitável, ou exigir
   pareamento por chave comum antes da carga de produção.
3. **Escopo do `GET /api/v1/hospitais/{id}/indicadores`:** pertence ao **Épico 04**
   (agregados públicos), não ao Épico 01 — alinhar com a Renata para adiar/remover
   a chamada do frontend.

---

*Documento gerado na entrega do Épico 01 (20/08/2026). Revisar antes da próxima sprint.*
