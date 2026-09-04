/**
 * Setup global do Jest: mocks de APIs nativas (fetch, AsyncStorage, expo-location,
 * expo-notifications, expo-constants, expo-file-system, expo-sharing) para que os
 * serviços possam ser testados sem device/emulador.
 */

/**
 * `global.fetch` é SEMPRE substituído — a atribuição não é condicional.
 *
 * A versão anterior era `if (!global.fetch) { global.fetch = jest.fn(); }`, com o
 * comentário "fetch global é fornecido pelo jest-expo/node; garantimos que exista
 * como spy". A partir do Node 18 existe `fetch` nativo, então o guard **nunca
 * disparava**: o fetch real sobrevivia e o spy nunca era instalado. Qualquer teste
 * que esquecesse de montar o próprio mock passava a fazer HTTP de verdade, em
 * silêncio — sem falhar, só lento e instável.
 *
 * Foi o que aconteceu com o `App.test.js`: ele montava o `App` real e disparava
 * `GET /api/v1/visitas/ativas` contra `192.168.0.10:8080`, um host que não responde
 * no ambiente de teste. Cada chamada armava o temporizador de 20 s do
 * `fetchComTimeout` e abria um socket TCP que sobreviviam ao fim do teste — origem
 * do aviso "A worker process has failed to exit gracefully". Custava ~40 s de
 * parede por execução e trazia o relógio da rede para dentro das asserções.
 *
 * O padrão rejeita com um erro identificável em vez de devolver uma resposta
 * boazinha: teste que toca a rede sem dizer o que espera dela não está testando o
 * app, está testando a rede.
 *
 * ATENÇÃO ao que isto **não** garante: não é um portão. O erro só reprova o teste
 * se chegar até uma asserção. Código de produção que trata falha de rede — que é
 * quase todo ele aqui — engole o erro e a suíte segue verde; medido no
 * `App.test.js`, que passa nos dois cenários. O ganho real é outro e é o que
 * importa: nenhuma requisição de verdade sai, então acabam o socket pendurado, o
 * temporizador órfão e o tempo de parede esperando host morto. Para transformar
 * isso em portão seria preciso afirmar sobre a chamada no próprio teste.
 *
 * O erro é um `Error` comum de propósito — `classificarErroDeRede` repassa o que
 * não é falha de rede, e o `fetchComRetry` só repete `ErroDeConexao`. Um
 * `TypeError("Network request failed")` aqui viraria `ErroDeConexao`, dispararia o
 * backoff da OPS-05 e deixaria um novo timer pendurado: trocaria um vazamento por
 * outro. Verificado — foi o que aconteceu na sondagem que levantou este defeito.
 *
 * Cada suíte que precisa de rede instala o seu: `global.fetch = jest.fn(...)`.
 * `clearMocks` do jest.config.js usa `mockClear()`, que zera as chamadas e
 * PRESERVA a implementação — este padrão sobrevive entre os testes.
 */
global.fetch = jest.fn(async (url, config) => {
  const metodo = String(config?.method || "GET").toUpperCase();

  throw new Error(
    `fetch não mockado: ${metodo} ${url}\n` +
      "Este teste tentou usar a rede real. Instale um mock explícito " +
      "(`global.fetch = jest.fn(...)`) declarando a resposta que o teste espera."
  );
});

// expo-constants: hostUri controlável pelos testes (config/api).
jest.mock("expo-constants", () => {
  const actual = jest.requireActual("expo-constants");
  return {
    ...actual,
    __esModule: true,
    default: {
      expoConfig: { hostUri: "192.168.0.10:8081", extra: {} },
      expoGoConfig: {},
      manifest2: null,
    },
  };
});

// expo-location: funções spyáveis (permissão, posição atual, watch, geofencing).
jest.mock("expo-location", () => {
  const PermissionStatus = { GRANTED: "granted", DENIED: "denied" };
  return {
    __esModule: true,
    PermissionStatus,
    Accuracy: { BestForNavigation: "BestForNavigation", Balanced: "Balanced" },
    GeofencingEventType: { Enter: 1, Exit: 2 },
    requestForegroundPermissionsAsync: jest.fn(),
    getForegroundPermissionsAsync: jest.fn(),
    requestBackgroundPermissionsAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
    watchPositionAsync: jest.fn(),
    startGeofencingAsync: jest.fn(),
    stopGeofencingAsync: jest.fn(),
  };
});

// expo-notifications: APIs usadas pelo FeedbackNotificationService.
jest.mock("expo-notifications", () => {
  const SchedulableTriggerInputTypes = { DATE: "date", TIME_INTERVAL: "timeInterval" };
  const AndroidImportance = { HIGH: 4, DEFAULT: 3 };
  return {
    __esModule: true,
    SchedulableTriggerInputTypes,
    AndroidImportance,
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(async (input) => `id-${Math.random().toString(16).slice(2)}`),
    cancelScheduledNotificationAsync: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(async () => []),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  };
});

// expo-file-system: sistema de arquivos em memória (download do PDF de exportação, E5-03).
jest.mock("expo-file-system", () => {
  class File {
    constructor(...partes) {
      const nome = String(partes[partes.length - 1]);
      this.name = nome;
      this.uri = `file:///cache/${nome}`;
    }
  }
  File.downloadFileAsync = jest.fn(async (_url, destino) => destino);

  return {
    __esModule: true,
    File,
    Paths: { cache: { uri: "file:///cache/" }, document: { uri: "file:///document/" } },
  };
});

// expo-network: estado de conectividade consultado ao classificar falha de rede
// (E8-04). O padrão é "conectado", para que a falha simulada nos testes seja
// atribuída ao servidor; testes de conectividade sobrescrevem o retorno.
jest.mock("expo-network", () => ({
  __esModule: true,
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
}));

// expo-sharing: menu de compartilhamento do sistema (E5-03).
jest.mock("expo-sharing", () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

// Cofre do expo-secure-store fora da fábrica do mock: o `__reset` do
// AsyncStorage, que as suítes já chamam, limpa os dois armazenamentos de uma
// vez. Sem isso, um token gravado num teste vazaria para o seguinte.
const mockCofreSeguro = {};

// expo-secure-store: Keychain/EncryptedSharedPreferences em memória (ARQ-02).
jest.mock("expo-secure-store", () => ({
  __esModule: true,
  setItemAsync: jest.fn(async (k, v) => {
    mockCofreSeguro[k] = String(v);
  }),
  getItemAsync: jest.fn(async (k) => (k in mockCofreSeguro ? mockCofreSeguro[k] : null)),
  deleteItemAsync: jest.fn(async (k) => {
    delete mockCofreSeguro[k];
  }),
  isAvailableAsync: jest.fn(async () => true),
  __reset: () => {
    Object.keys(mockCofreSeguro).forEach((k) => delete mockCofreSeguro[k]);
  },
}));

// @react-native-async-storage/async-storage: armazenamento em memória.
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k) => (k in store ? store[k] : null)),
      setItem: jest.fn(async (k, v) => { store[k] = String(v); }),
      removeItem: jest.fn(async (k) => { delete store[k]; }),
      multiSet: jest.fn(async (pares) => { pares.forEach(([k, v]) => { store[k] = String(v); }); }),
      multiRemove: jest.fn(async (ks) => { ks.forEach((k) => { delete store[k]; }); }),
      __reset: () => {
        Object.keys(store).forEach((k) => delete store[k]);
        Object.keys(mockCofreSeguro).forEach((k) => delete mockCofreSeguro[k]);
      },
    },
  };
});
