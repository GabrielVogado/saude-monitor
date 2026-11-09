/**
 * Conversão do `style` das camadas de `utils/mapkit` (formato das telas: `fillColor`,
 * `fillOpacity`, `lineColor`, `lineWidth`) em `paint` da especificação de estilo do
 * MapLibre. Compartilhada pelos adaptadores nativo e Web para os geofences saírem iguais
 * nas duas plataformas. Chave sem valor não entra: fica o padrão da biblioteca.
 */
export function pinturaDoPreenchimento(style = {}) {
  const paint = { "fill-color": style.fillColor };
  if (style.fillOpacity !== undefined) paint["fill-opacity"] = style.fillOpacity;
  return paint;
}

export function pinturaDaLinha(style = {}) {
  const paint = { "line-color": style.lineColor };
  if (style.lineWidth !== undefined) paint["line-width"] = style.lineWidth;
  return paint;
}
