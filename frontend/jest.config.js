/**
 * Configuração do Jest para o app React Native (Expo SDK 55).
 * Usa o preset `jest-expo`, que já transpila JSX/imports do RN.
 */
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.js"],
  setupFiles: ["./jest.setup.js"],
  setupFilesAfterEnv: ["./jest.setup-after-env.js"],

  // Precisa ser MAIOR que o `asyncUtilTimeout` de 5 s do jest.setup-after-env.js.
  // Com os dois em 5 s -- o padrao do Jest tambem e 5 s --, a folga dada ao
  // `findBy*` nunca chegava a ser usada: o teste inteiro estourava no mesmo
  // instante, e a falha vinha como "Exceeded timeout of 5000 ms for a test" em vez
  // da mensagem util do testing-library, que diz QUAL elemento nao foi encontrado e
  // mostra a arvore renderizada. A folga existia no papel e nao no comportamento.
  testTimeout: 15000,
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))",
  ],
  clearMocks: true,

  // Cobertura (DOD-01 / E8-08). Mede o código de produção: testes, estilos e o
  // ponto de entrada do Expo não dizem nada sobre a qualidade da suíte.
  collectCoverageFrom: [
    "src/**/*.js",
    // App.js entra porque a exclusao inflava a linha de base: sao 191 linhas com a
    // arvore de navegacao inteira e os listeners de notificacao -- codigo de
    // producao como qualquer outro, e dos mais sensiveis. Medir sem ele e medir o
    // que da jeito.
    "App.js",
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
