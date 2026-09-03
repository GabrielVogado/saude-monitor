/**
 * Setup que depende do framework de teste já instalado (por isso
 * `setupFilesAfterEnv`, e não `setupFiles`): o testing-library registra os
 * matchers em `expect` ao ser importado.
 */
const { configure } = require("@testing-library/react-native");

// O `findBy*` espera 1 s por padrão — folga que a instrumentação de cobertura
// consome inteira nas telas com lista virtualizada, reprovando o teste por
// lentidão de máquina, e não por defeito. 5 s não deixa nenhum teste travado:
// quem falha de verdade falha igual, só um pouco depois.
//
// INVARIANTE: este valor precisa ficar ABAIXO do `testTimeout` do jest.config.js
// (hoje 15 s). Se os dois se igualarem, o teste estoura antes de o `findBy*` poder
// falhar por conta própria, e a mensagem volta a ser "Exceeded timeout of N ms" em
// vez de dizer qual elemento faltou. Foi exatamente esse o defeito da P-003(a), e
// nada no código impede que ele volte: subir este número sem subir o outro o
// reintroduz em silêncio.
configure({ asyncUtilTimeout: 5000 });
