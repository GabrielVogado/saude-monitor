# Validação do georreferenciamento — pontos × endereços × RAs (12/09/2026)

> **Origem:** relato do PO com evidência em aparelho — polígonos sobrepostos, círculos
> "sem unidade atrelada", e desconfiança de que os endereços de `multiplas_camadas_saude_14`
> e `backend/data` estejam corretamente apontados no mapa.
> **Método:** 340 docs do backend de dev × polígonos oficiais das 35 RAs (`Regiões_Administrativas.shp`
> em precisão total — **não** a versão simplificada a 10%) via point-in-polygon (ray casting,
> com furos), + comparação ponto a ponto das duas pastas-fonte. Scripts em
> `C:\Users\Gabriel\AppData\Local\Temp\opencode\camadas\` (`valida-ra2.js`, `cmp-pts.js`).

## 1. As duas pastas-fonte são o mesmo dado (dúvida "quais arquivos valem" — encerrada)

| Camada | Feats A/B | Divergência máxima de ponto |
|---|---|---|
| 9 camadas (UBS 183, Hospitais, UPA, Policlínicas, CAPS, Centr.Esp, Outras, Indígena, Rua) | iguais | **0 m** |
| UBS Prisionais (9) | iguais | **0 m** por índice (a divergência de 148 m numa primeira passada era artefato do meu casamento por nome — as 5 linhas da Papuda têm o mesmo endereço) |

**Veredito:** `backend/data` (input do seed) ≡ `multiplas_camadas_saude_14` ponto a ponto e atributo a atributo. Não há "versão certa e errada" entre as pastas.

## 2. Ponto × RA declarada: 326/340 dentro (96%)

Regra: o ponto da unidade deve cair dentro do polígono da RA do seu `endereco.bairro` (com alias de sub-áreas: Asa Sul/Norte/Noroeste→Plano Piloto, Guará I→Guará, Riacho Fundo→Riacho Fundo I, SCIA→SCIA/Estrutural, typos Samambia→Samambaia etc.). **13 fora** (polígonos em precisão total — não é artefato de simplificação):

| Unidade | Declara | Cai em | Avaliação |
|---|---|---|---|
| Caps Riacho Fundo · Farmácia Viva | Riacho Fundo I | Riacho Fundo II | suspeita (mesma direção) |
| Ubs 03 Riacho Fundo II | Riacho Fundo II | Riacho Fundo I | **erro provado** — divide o ponto exato com `Ubs 01 Riacho Fundo I` (DUP-03: dois CNES distintos, `0011169` × `2660199`, endereços Qn 09 × Qn 07) |
| Oficina Ortopédica do DF | SIA | Guará | borda SIA/Guará — campo |
| Ubs 01 Sia - Cpp | Guará | SIA | borda — campo (endereços trocados entre si sugerem inversão) |
| Ubs 04 Itapoa | Itapoã | Paranoá | borda — campo |
| Ubs 20 + 5× Ubs São Sebastião (Papuda) | São Sebastião | Jardim Botânico | **divergência fonte × RA oficial** (6 unidades, mesma direção): ou o complexo da Papuda está endereçado pela RA vizinha na fonte, ou o polígono oficial o exclui — decidir com a SES, não no código |
| Upa Sobradinho | Sobradinho II | Sobradinho | RAs vizinhas — campo |

Não classificável: `Hospital Regional de Brazlândia` (bairro "Setor Tradicional", sem RA correspondente).
**Contradição interna que merece atenção:** no cluster Riacho Fundo, duas unidades declaram RF I e caem em RF II enquanto uma declara RF II e cai em RF I — pelo menos um dos lados está errado além do DUP-03.

## 3. "Polígonos sem unidade atrelada" — invariante do código

No modo lista (E8-03), polígono e marcador nascem do **mesmo** `centroDoHospital(hospital)` (`geojson.js`: `coordenadasDoHospital` × `centroDoHospital`): **é impossível um polígono existir sem seu marcador** — o filtro `vertices.length > 0` vale para os dois. O que se vê como "círculo solto" é uma destas situações, todas já tratadas:
- marcador escondido sob outro rótulo (âncora BUG-10 corrigida; rótulos sobrepostos em cluster denso);
- marcador fora da viewport com o círculo parcialmente visível na borda;
- toque abrindo a unidade errada da pilha — **BUG-11** (seletor "Várias unidades neste local", na branch; confirme que o APK instalado contém o run `34670849262` ou posterior).
Se um círculo sem ponto persistir **após** esses três, é caso novo: fotografar com o nome da unidade visível mais próxima e reabrir.

## 4. Confiança nos endereços — síntese honesta

- **Alto:** 326/340 dentro da RA declarada; fontes-fonte idênticas; bbox íntegro.
- **Médio (campo necessário):** 12 bordas/divergências da tabela acima — nenhuma prova de erro além do DUP-03, mas também nenhuma prova de acerto: endereço diz uma RA, polígono oficial diz outra.
- **Baixo:** par DUP-03 (erro certo, um dos dois pontos) e os 23 duplicados lógicos do relatório de duplicatas (já endereçados: seed two-phase + limpeza pendente).
- **Fora de escopo desta validação:** ground-truth rua a rua (geocodificação externa de 340 endereços).
