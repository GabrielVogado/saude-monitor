/**
 * Envio periódico da fila offline com o app fechado (M-075): a tarefa só fala com a rede
 * quando há algo guardado, e o registro no SO acontece uma vez, nunca no navegador.
 */

jest.mock("expo-background-task", () => ({
  __esModule: true,
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => {}),
}));

jest.mock("expo-task-manager", () => ({
  __esModule: true,
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));

jest.mock("../../config/filaOffline", () => ({
  __esModule: true,
  tamanhoDaFila: jest.fn(async () => 0),
}));

jest.mock("../../services/SincronizacaoOffline", () => ({
  __esModule: true,
  sincronizar: jest.fn(async () => ({ enviados: 1 })),
}));

jest.mock("../../config/monitoramento", () => ({
  __esModule: true,
  registrarErro: jest.fn(),
}));

/**
 * Carrega o módulo do zero e espera o registro que ele dispara no carregamento terminar,
 * para os valores que cada teste programa nos mocks não serem consumidos por ele.
 */
async function carregar(plataforma = "android") {
  jest.resetModules();
  const { Platform } = require("react-native");
  Platform.OS = plataforma;
  const modulo = require("../../services/EnvioFilaSegundoPlano");
  await new Promise((resolve) => setImmediate(resolve));
  return {
    modulo,
    BackgroundTask: require("expo-background-task"),
    TaskManager: require("expo-task-manager"),
    fila: require("../../config/filaOffline"),
    sincronizacao: require("../../services/SincronizacaoOffline"),
    monitoramento: require("../../config/monitoramento"),
  };
}

describe("EnvioFilaSegundoPlano", () => {
  const { Platform } = require("react-native");
  const plataformaOriginal = Platform.OS;

  afterEach(() => {
    require("react-native").Platform.OS = plataformaOriginal;
  });

  describe("tarefa", () => {
    it("define a tarefa no carregamento do módulo", async () => {
      const { modulo, TaskManager } = await carregar();
      expect(TaskManager.defineTask).toHaveBeenCalledWith(modulo.ENVIO_FILA_TASK, modulo.executarEnvioDaFila);
    });

    it("com a fila vazia termina sem tentar enviar", async () => {
      const { modulo, fila, sincronizacao } = await carregar();
      fila.tamanhoDaFila.mockResolvedValueOnce(0);

      await expect(modulo.executarEnvioDaFila()).resolves.toBe(1);
      expect(sincronizacao.sincronizar).not.toHaveBeenCalled();
    });

    it("com itens na fila envia e responde sucesso", async () => {
      const { modulo, fila, sincronizacao } = await carregar();
      fila.tamanhoDaFila.mockResolvedValueOnce(2);

      await expect(modulo.executarEnvioDaFila()).resolves.toBe(1);
      expect(sincronizacao.sincronizar).toHaveBeenCalledTimes(1);
    });

    it("uma falha no envio vira resultado de falha e vai para o monitoramento", async () => {
      const { modulo, fila, sincronizacao, monitoramento } = await carregar();
      const erro = new Error("armazenamento indisponível");
      fila.tamanhoDaFila.mockResolvedValueOnce(1);
      sincronizacao.sincronizar.mockRejectedValueOnce(erro);

      await expect(modulo.executarEnvioDaFila()).resolves.toBe(2);
      expect(monitoramento.registrarErro).toHaveBeenCalledWith(erro, "fila.segundoPlano");
    });
  });

  describe("registro no SO", () => {
    it("registra a cada 15 minutos quando ainda não está registrada", async () => {
      const { modulo, BackgroundTask } = await carregar();
      BackgroundTask.registerTaskAsync.mockClear();

      await expect(modulo.registrarEnvioPeriodico()).resolves.toBe(true);
      expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(modulo.ENVIO_FILA_TASK, {
        minimumInterval: 15,
      });
    });

    it("não registra de novo o que já está registrado", async () => {
      const { modulo, BackgroundTask, TaskManager } = await carregar();
      BackgroundTask.registerTaskAsync.mockClear();
      TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(true);

      await expect(modulo.registrarEnvioPeriodico()).resolves.toBe(true);
      expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });

    it("não registra quando o SO restringe tarefas de segundo plano", async () => {
      const { modulo, BackgroundTask } = await carregar();
      BackgroundTask.registerTaskAsync.mockClear();
      BackgroundTask.getStatusAsync.mockResolvedValueOnce(1);

      await expect(modulo.registrarEnvioPeriodico()).resolves.toBe(false);
      expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });

    it("uma falha no registro não derruba o app e vai para o monitoramento", async () => {
      const { modulo, BackgroundTask, monitoramento } = await carregar();
      const erro = new Error("WorkManager indisponível");
      BackgroundTask.registerTaskAsync.mockRejectedValueOnce(erro);

      await expect(modulo.registrarEnvioPeriodico()).resolves.toBe(false);
      expect(monitoramento.registrarErro).toHaveBeenCalledWith(erro, "fila.registroSegundoPlano");
    });

    it("no navegador não define nem registra a tarefa", async () => {
      const { modulo, BackgroundTask, TaskManager } = await carregar("web");

      await expect(modulo.registrarEnvioPeriodico()).resolves.toBe(false);
      expect(TaskManager.defineTask).not.toHaveBeenCalled();
      expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });
  });
});
