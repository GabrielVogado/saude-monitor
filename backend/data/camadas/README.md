# Camadas geográficas — geração dos GeoJSON (F-11, §5.2)

Os 4 arquivos servidos em `GET /api/v1/camadas/{tipo}` vivem em
`backend/src/main/resources/camadas/` (919 KB somados). São gerados dos shapefiles
`multiplas_camadas_saude_14/*.shp` (CRS `GCS_WGS_1984`, já lon/lat — sem reprojeção)
com [`mapshaper`](https://github.com/mbostock/... ) — na prática o pacote npm
`mapshaper` (testado com 0.7.61):

```powershell
$src = "D:\saude-monitor\multiplas_camadas_saude_14"
npx mapshaper "$src\Regiões_Administrativas.shp" -simplify 10% keep-shapes `
  -rename-fields nome=RA,regiaoSaude=RS,macrorregiaoSaude=Macro `
  -o backend/src/main/resources/camadas/regiao-administrativa.geojson format=geojson
npx mapshaper "$src\Região_Integrada_de_Desen.shp" -simplify 10% keep-shapes `
  -rename-fields nome=Municipio `
  -o backend/src/main/resources/camadas/ride.geojson format=geojson
npx mapshaper "$src\Regiões_de_Saúde.shp" -simplify 10% keep-shapes `
  -rename-fields nome=RS,macrorregiaoSaude=Macro,regioesAdministrativas=Regioes_Ad `
  -o backend/src/main/resources/camadas/regiao-saude.geojson format=geojson
npx mapshaper "$src\Macrorregiões_de_Saúde.shp" -simplify 10% keep-shapes `
  -rename-fields nome=Macro,regioesSaude=Regioes_de `
  -o backend/src/main/resources/camadas/macrorregiao-saude.geojson format=geojson
```

## Verificação pós-geração (12/09/2026)

| Camada | Features | Propriedades | Tamanho |
|---|---|---|---|
| `regiao-administrativa` | 35 | `nome`, `regiaoSaude`, `macrorregiaoSaude` | ~442 KB |
| `ride` | 33 | `nome` | ~302 KB |
| `regiao-saude` | 7 | `nome`, `macrorregiaoSaude`, `regioesAdministrativas` | ~66 KB |
| `macrorregiao-saude` | 3 | `nome`, `regioesSaude` | ~109 KB |

- Encoding sai UTF-8 correto via `.cpg` (`Água Quente`, `Macrorregião 2`, `Sudoeste/Octogonal`).
- O `simplify` reporta interseções não reparáveis (65 nas RAs, 9 nas Macros) —
  artefato visual de simplificação em fronteiras compartilhadas, aceito para camada
  de exibição (não há cálculo espacial sobre estes polígonos).
- Auditoria de atributos (§5.2 item 2): valores preservados da fonte, sem mapeamento
  inventado — `Sudoeste/Octogonal` mantido literal. Divergência conhecida fica
  registrada aqui, não "corrigida" no escuro.
- Os testes `RegiaoServiceTest` travam contagens e chaves de propriedade: após
  regenerar, `RegiaoServiceTest` + `RegiaoControllerTest` precisam continuar verdes.
