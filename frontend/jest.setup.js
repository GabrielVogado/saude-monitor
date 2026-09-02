/**
 * Setup global do Jest: mocks de APIs nativas (fetch, AsyncStorage, expo-location,
 * expo-notifications, expo-constants, expo-file-system, expo-sharing) para que os
 * serviços possam ser testados sem device/emulador.
 */

// fetch global é fornecido pelo jest-expo/node; garantimos que exista como spy
// substituível por cada teste via global.fetch.
if (!global.fetch) {
  global.fetch = jest.fn();
}

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
