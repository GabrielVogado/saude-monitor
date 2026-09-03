/**
 * Guarda contra o mecanismo que escondeu três módulos órfãos.
 *
 * `src/components/index.js` reexporta todo componente da pasta. Isso faz com que um
 * `grep` por qualquer nome de componente sempre encontre pelo menos uma referência —
 * a do próprio barrel. Resultado: `CSSelect` e `CSGeoStatusCard` ficaram meses sem
 * nenhum consumidor real sem que nada acusasse, porque o barrel os "usava".
 *
 * Este teste quebra o disfarce: cada nome exportado pelo barrel precisa ser
 * importado por pelo menos um módulo de produção que NÃO seja o próprio barrel.
 *
 * Se falhar, há duas saídas legítimas — passar a usar o componente, ou removê-lo
 * junto com a linha do barrel. O que não é legítimo é deixá-lo exportado e não
 * utilizado, porque é assim que a pasta volta a acumular resíduo.
 */
const fs = require("fs");
const path = require("path");

// A raiz e descoberta subindo ate o package.json, e nao com um numero fixo de "..".
// Com o caminho fixo o scan devolvia lista vazia dentro do Jest, e o teste reprovava
// TODOS os componentes -- inclusive os que estao em uso. Um teste que reprova tudo
// nao acusa nada; so parece rigoroso.
function acharRaiz(dir) {
  if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  const pai = path.dirname(dir);
  if (pai === dir) throw new Error("package.json nao encontrado a partir de " + __dirname);
  return acharRaiz(pai);
}

const RAIZ = acharRaiz(__dirname);
const BARREL = path.join(RAIZ, "src", "components", "index.js");

function arquivosDeProducao(dir, acc = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const alvo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "__tests__" || entrada.name === "node_modules") continue;
      arquivosDeProducao(alvo, acc);
    } else if (entrada.name.endsWith(".js") && alvo !== BARREL) {
      acc.push(alvo);
    }
  }
  return acc;
}

describe("barrel de src/components", () => {
  const exportados = [
    ...fs.readFileSync(BARREL, "utf8").matchAll(/export\s+\{\s*default\s+as\s+(\w+)\s*\}/g),
  ].map((m) => m[1]);

  const fontes = [
    ...arquivosDeProducao(path.join(RAIZ, "src")),
    path.join(RAIZ, "App.js"),
  ].map((f) => fs.readFileSync(f, "utf8"));

  test("o barrel exporta ao menos um componente (o regex não silenciou)", () => {
    expect(exportados.length).toBeGreaterThan(0);
  });

  test.each(exportados)("%s é importado por algum módulo de produção", (nome) => {
    // Regex montado por concatenação de propósito: dentro de template literal o
    // escape de `` é fácil de errar, e o erro se manifesta como "nenhum arquivo
    // casa — um teste que reprova tudo é tão inútil quanto um que aprova tudo.
    const limite = new RegExp(/\b/.source + nome + /\b/.source);
    const usos = fontes.filter((conteudo) => limite.test(conteudo)).length;

    // 1 = apenas o próprio arquivo do componente. Consumidor real exige ≥ 2.
    expect(usos).toBeGreaterThan(1);
  });
});
