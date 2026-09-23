/**
 * Configuração do ESLint para o app React Native (Expo SDK 55) — E8-13.
 *
 * O gate estático que existia antes deste arquivo era decorativo: o
 * `npm run typecheck` roda `tsc --noEmit` sobre um projeto 100% `.js` com
 * `checkJs: false` no `tsconfig.json`, ou seja, não verificava uma linha
 * sequer. O lint é o primeiro verificador estático real da esteira.
 *
 * Base: `eslint-config-expo`, que já traz as regras de React, React Hooks e
 * React Native calibradas para o SDK. As regras adicionadas abaixo são as que
 * pegam defeito de verdade neste código — não estilo.
 */
const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  {
    // Artefatos de build e dependências. `coverage/` e `.expo/` são gerados a
    // cada execução da esteira e não são código do projeto.
    ignores: [
      "node_modules/**",
      "coverage/**",
      ".expo/**",
      "dist/**",
      "android/**",
      "ios/**",
      "scripts/**",
    ],
  },

  ...expoConfig,

  {
    rules: {
      /**
       * Dependências de hook. É a regra que paga o custo do lint sozinha:
       * um `useEffect` com dependência faltando é a origem clássica de tela
       * que não atualiza e de requisição disparada em laço.
       */
      "react-hooks/exhaustive-deps": "warn",

      /**
       * Variável não usada indica refatoração pela metade — quase sempre o
       * resto de um trecho que deixou de ser chamado. Argumentos com prefixo
       * `_` seguem liberados, que é a convenção para parâmetro obrigatório e
       * ignorado de propósito.
       */
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Erros de digitação em nome de variável e uso antes da declaração.
      "no-undef": "error",

      // `==` entre tipos diferentes já causou comparação silenciosamente falsa
      // em código de status de visita. `null` continua liberado.
      eqeqeq: ["error", "always", { null: "ignore" }],

      // Sobra de depuração não vai para a loja.
      "no-debugger": "error",

      /**
       * `console` fica em `warn`, não proibido: os dois únicos usos do app
       * estão no `GeofencingTaskService`, que roda em background e precisa
       * deixar rastro de falha em algum lugar — cada um já traz o
       * `eslint-disable-next-line` documentando a escolha. A regra existe para
       * que esses dois casos continuem sendo exceção declarada, e não hábito.
       * Quando o E8-07 (crash reporting) entrar, eles viram evento de verdade.
       */
      "no-console": "warn",

      /**
       * As três regras abaixo vêm da geração "React Compiler" do
       * `eslint-plugin-react-hooks` e acusam 15 ocorrências no código atual —
       * escrita de `ref.current` durante o render, `setState` síncrono dentro
       * de efeito e chamada impura (`new Date()`) no corpo do componente.
       *
       * Nenhuma delas é defeito visível hoje: são padrões deliberados, alguns
       * com comentário explicando a escolha. Mas são exatamente a dívida que o
       * ARQ-03 (sem estado global reativo) descreve, e viram erro de verdade
       * quando o React Compiler entrar.
       *
       * Ficam em `warn` pelo mesmo critério do piso de cobertura (E8-08): a
       * porta existe para impedir regressão, não para reprovar o código atual.
       * Promovê-las a `error` é decisão consciente de sprint, depois de tratar
       * as ocorrências existentes.
       */
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },

  {
    files: ["src/**/__tests__/**/*.js", "jest.setup*.js", "jest.config.js"],
    languageOptions: {
      // `eslint-config-expo` cobre o app, não a suíte. Sem declarar os globais
      // do Jest, o `no-undef` acusaria 931 falsos positivos — um por chamada de
      // `expect`, `jest` ou `describe` — e afogaria os defeitos reais.
      globals: {
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
        // Globais do CommonJS/Node. A suíte roda no Jest, não no bundle do app: um
        // teste que inspeciona a árvore de arquivos (barrel.test.js) precisa de
        // `require`, `__dirname` e `process`, e sem declará-los o `no-undef` os
        // acusaria como variáveis inexistentes.
        require: "readonly",
        module: "writable",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
      },
    },
    rules: {
      // Nos testes, variável de apoio não usada é ruído aceitável.
      "no-unused-vars": "off",

      /**
       * O `jest.setup.js` acrescenta auxiliares (`__reset`) aos módulos
       * mockados, e o resolvedor estático do `import/namespace` não enxerga
       * isso — é falso positivo por construção dentro da suíte.
       */
      "import/namespace": "off",
    },
  },
];
