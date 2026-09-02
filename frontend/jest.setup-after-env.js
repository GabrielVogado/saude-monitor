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
configure({ asyncUtilTimeout: 5000 });
