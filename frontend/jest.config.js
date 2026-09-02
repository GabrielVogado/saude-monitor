/**
 * Configuração do Jest para o app React Native (Expo SDK 55).
 * Usa o preset `jest-expo`, que já transpila JSX/imports do RN.
 */
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.js"],
  setupFiles: ["./jest.setup.js"],
  setupFilesAfterEnv: ["./jest.setup-after-env.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))",
  ],
  clearMocks: true,

  // Cobertura (DOD-01 / E8-08). Mede o código de produção: testes, estilos e o
  // ponto de entrada do Expo não dizem nada sobre a qualidade da suíte.
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/__tests__/**",
    "!src/**/css/**",
    "!src/theme/**",
  ],
  coverageReporters: ["text-summary", "lcov"],

  /**
   * Piso de cobertura no patamar medido hoje, arredondado para baixo: a porta
   * existe para impedir regressão, não para reprovar o código atual. Elevar o
   * número é decisão consciente de sprint.
   */
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 58,
      functions: 65,
      lines: 70,
    },
  },
};
