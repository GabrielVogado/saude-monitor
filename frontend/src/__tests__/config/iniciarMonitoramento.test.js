/**
 * E8-07: o `index.js` importa este módulo primeiro, e só o import já liga o monitoramento
 * — antes de `App`, `sessaoApi` e o geofencing serem avaliados.
 */
jest.mock("../../config/monitoramento", () => ({ iniciarMonitoramento: jest.fn() }));

test("importar o módulo liga o monitoramento uma vez", () => {
  const { iniciarMonitoramento } = require("../../config/monitoramento");
  jest.isolateModules(() => {
    require("../../config/iniciarMonitoramento");
  });
  expect(iniciarMonitoramento).toHaveBeenCalledTimes(1);
});
