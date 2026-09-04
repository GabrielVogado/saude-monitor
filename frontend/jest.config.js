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

  // Cobertura (DOD-01 / E8-08). Mede o código de produção: testes e estilos não
  // dizem nada sobre a qualidade da suíte. O ponto de entrada do Expo que continua
  // fora é o `index.js` (9 linhas, só `registerRootComponent`) — o `App.js` NÃO é
  // ponto de entrada nesse sentido, e por isso entra; ver o comentário abaixo.
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
   * existe para impedir regressão, não para reprovar o código atual.
   *
   * O piso sobe a cada onda de cobertura, como o teto de avisos do lint (E8-13):
   * ganho que não vira piso não está protegido — apagar os testes novos voltaria a
   * passar no CI. Meta do PO (04/09/2026): **90% em todo o frontend**, medida nas
   * quatro métricas.
   *
   * Histórico: 70/58/65/70 (E8-08, 02/09) → 78/66/76/79 (Onda 1, 04/09) →
   * 79/67/77/80 (pós-merge da OPS-05 #75, 04/09) → 90 (meta).
   *
   * FOLGA REAL neste patamar, medida em 79,77/67,96/77,90/80,28:
   *
   *   statements 0,77pp · branches 0,96pp · functions 0,90pp · **lines 0,28pp**
   *
   * `lines` é o gargalo: 0,28pp de 1.674 linhas são ~5 linhas. Um punhado de
   * linhas novas sem teste reprova o CI — o que é a intenção da porta, mas cobra
   * disciplina de quem abrir o próximo PR. Se reprovar por margem e não por
   * regressão, o caminho é cobrir as linhas novas, não baixar o piso.
   */
  coverageThreshold: {
    global: {
      statements: 79,
      branches: 67,
      functions: 77,
      lines: 80,
    },
  },
};
