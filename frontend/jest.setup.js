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

// expo-sharing: menu de compartilhamento do sistema (E5-03).
jest.mock("expo-sharing", () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
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
      __reset: () => { Object.keys(store).forEach((k) => delete store[k]); },
    },
  };
});
