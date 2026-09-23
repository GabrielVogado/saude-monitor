/**
 * Guarda contra o mecanismo que escondeu módulos órfãos no projeto.
 *
 * `src/components/index.js` reexporta todo componente da pasta. Isso faz com que um
 * `grep` por qualquer nome de componente sempre encontre pelo menos uma referência —
 * a do próprio barrel. Resultado: `CSSelect` e `CSGeoStatusCard` ficaram meses sem
 * nenhum consumidor real sem que nada acusasse, porque o barrel os "usava".
 * (`src/screens/views/index.js` fazia o mesmo com 10 telas e foi removido — era um
 * barrel de compatibilidade sem um único importador.)
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

// A raiz é descoberta subindo até o package.json, e não com um número fixo de "..".
// Com o caminho fixo o scan devolvia lista vazia dentro do Jest, e o teste reprovava
// TODOS os componentes — inclusive os em uso. Um teste que reprova tudo não acusa
// nada; só parece rigoroso.
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

/**
 * Comentário não é consumo. Sem retirá-los, uma menção em prosa contaria como uso —
 * e este projeto tem exatamente esse caso: `GeofencingTaskService.js` cita
 * `CheckinManualScreen` num comentário justamente para dizer que a tela foi removida.
 * Um componente cuja última importação fosse apagada, mas restasse citado num
 * comentário, passaria pelo guarda.
 */
function semComentarios(conteudo) {
  return conteudo.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

/**
 * Extrai TODO nome exportado, e não apenas o `default as X`.
 *
 * A primeira versão usava /export\s+\{\s*default\s+as\s+(\w+)\s*\}/ e exigia `}`
 * logo após o nome — então `export { default as CSLoading, CSLoadingList }` casava
 * com nada, e 2 dos 12 nomes ficavam sem verificação nenhuma.
 */
function nomesExportados(fonte) {
  const nomes = [];
  for (const bloco of fonte.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const entrada of bloco[1].split(",")) {
      const limpo = entrada.trim();
      if (!limpo) continue;
      const comAlias = limpo.match(/(?:\w+)\s+as\s+(\w+)$/);
      nomes.push(comAlias ? comAlias[1] : limpo);
    }
  }
  return nomes;
}

describe("barrel de src/components", () => {
  const fonteBarrel = fs.readFileSync(BARREL, "utf8");
  const exportados = nomesExportados(fonteBarrel);

  const fontes = [
    ...arquivosDeProducao(path.join(RAIZ, "src")),
    path.join(RAIZ, "App.js"),
  ].map((f) => semComentarios(fs.readFileSync(f, "utf8")));

  test("todo nome do barrel é coberto — nenhuma linha escapa do parser", () => {
    // Sentinela: `length > 0` não bastaria, porque a versão anterior devolvia 10 de
    // 12 e passava. A contagem é comparada com o número de linhas `export` do arquivo.
    const linhasExport = fonteBarrel
      .split("\n")
      .filter((l) => l.trim().startsWith("export")).length;
    expect(linhasExport).toBeGreaterThan(0);
    expect(exportados.length).toBeGreaterThanOrEqual(linhasExport);
  });

  test.each(exportados)("%s é importado por algum módulo de produção", (nome) => {
    // /\b/.source em vez de "\b": dentro de string, o escape vira o caractere
    // BACKSPACE se um nível de escape se perder, e o regex deixa de casar com tudo.
    const limite = new RegExp(/\b/.source + nome + /\b/.source);
    const usos = fontes.filter((conteudo) => limite.test(conteudo)).length;

    // 1 = apenas o próprio arquivo do componente. Consumidor real exige ≥ 2.
    expect(usos).toBeGreaterThan(1);
  });
});
