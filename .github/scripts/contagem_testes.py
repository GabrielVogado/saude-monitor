#!/usr/bin/env python3
"""Trava de contagem de testes do CI (M-030).

Dois comandos:

  contar   lê o relatório real da execução de testes de uma área e grava
           `<saida>/<area>.json` com o número de testes executados.
  comparar compara a contagem do PR com a do commit da base (CI de push dele)
           e reprova quando a regra não é cumprida.

Regra (decisão do PO em 04/10/2026, "a quantidade de testes não pode ser menor ou
igual ao cenário anterior"):

  - área cujo código de produção o PR altera: a contagem precisa SUBIR;
  - demais áreas: a contagem não pode CAIR.

O segundo caso existe para não travar PR só de documentação ou de workflow, que
não tem como acrescentar teste a uma área que não tocou.

"Executados" = total menos ignorados (@Disabled, it.skip, it.todo). Desligar um
teste não conta como teste: sem esse desconto, trocar um teste por um skip
passaria na trava.
"""

import argparse
import fnmatch
import glob
import json
import os
import sys
import xml.etree.ElementTree as ET

AREAS = ("backend", "frontend", "admin")

# Código de produção de cada área: o que, alterado, exige teste novo. Segue o
# mesmo recorte da cobertura de cada área (jacoco em build.gradle,
# collectCoverageFrom em jest.config.js): estilo e tema não têm teste a cobrar.
CODIGO_DE_PRODUCAO = {
    "backend": {
        "incluir": ["backend/src/main/java/*"],
        "excluir": [],
    },
    "frontend": {
        "incluir": ["frontend/src/*", "frontend/App.js"],
        "excluir": ["frontend/src/__tests__/*", "frontend/src/*/css/*", "frontend/src/theme/*"],
    },
    "admin": {
        "incluir": ["admin/src/main.ts", "admin/src/app/*.ts", "admin/src/app/*.html"],
        "excluir": ["admin/src/*.spec.ts"],
    },
}


def _contar_junit(caminho):
    arquivos = sorted(glob.glob(os.path.join(caminho, "TEST-*.xml")))
    if not arquivos:
        raise SystemExit(f"Nenhum relatório JUnit em {caminho}: os testes rodaram?")
    executados = 0
    for arquivo in arquivos:
        raiz = ET.parse(arquivo).getroot()
        suites = [raiz] if raiz.tag == "testsuite" else raiz.findall("testsuite")
        for suite in suites:
            executados += int(suite.get("tests", 0)) - int(suite.get("skipped", 0))
    return executados


def _contar_json_jest(caminho):
    # Jest (`--json`) e o reporter `json` do Vitest usam o mesmo formato.
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
    return dados["numTotalTests"] - dados.get("numPendingTests", 0) - dados.get("numTodoTests", 0)


def contar(args):
    if args.area == "backend":
        executados = _contar_junit(args.relatorio)
    else:
        executados = _contar_json_jest(args.relatorio)
    os.makedirs(args.saida, exist_ok=True)
    with open(os.path.join(args.saida, f"{args.area}.json"), "w", encoding="utf-8") as f:
        json.dump({"area": args.area, "executados": executados}, f)
    print(f"{args.area}: {executados} testes executados")


def _ler(diretorio, area):
    caminho = os.path.join(diretorio, f"{area}.json") if diretorio else None
    if not caminho or not os.path.isfile(caminho):
        return None
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)["executados"]


def alterou_codigo(area, arquivos):
    regra = CODIGO_DE_PRODUCAO[area]
    for arquivo in arquivos:
        if any(fnmatch.fnmatch(arquivo, p) for p in regra["excluir"]):
            continue
        if any(fnmatch.fnmatch(arquivo, p) for p in regra["incluir"]):
            return True
    return False


def avaliar(area, base, atual, mexeu):
    """Devolve (aprovado, mensagem)."""
    if atual is None:
        return False, "contagem do PR não encontrada"
    if base is None:
        return True, "sem contagem da base (primeira execução): só registrada"
    if mexeu and atual <= base:
        return False, "o PR altera o código desta área e não acrescenta teste"
    if not mexeu and atual < base:
        return False, "o PR remove testes desta área"
    return True, "ok"


def comparar(args):
    with open(args.alterados, encoding="utf-8") as f:
        arquivos = [linha.strip() for linha in f if linha.strip()]

    linhas = [
        "## Trava de contagem de testes",
        "",
        "| Área | Base | PR | Código alterado | Exigência | Resultado |",
        "|------|-----:|---:|:---------------:|-----------|-----------|",
    ]
    reprovou = False
    for area in AREAS:
        base = _ler(args.base, area)
        atual = _ler(args.atual, area)
        mexeu = alterou_codigo(area, arquivos)
        aprovado, motivo = avaliar(area, base, atual, mexeu)
        reprovou |= not aprovado
        linhas.append(
            f"| {area} | {'—' if base is None else base} | {'—' if atual is None else atual} "
            f"| {'sim' if mexeu else 'não'} | {'subir' if mexeu else 'não cair'} "
            f"| {'✅' if aprovado else '❌'} {motivo} |"
        )
        if not aprovado:
            print(f"::error title=Trava de testes ({area})::{motivo} (base {base}, PR {atual})")

    resumo = "\n".join(linhas) + "\n"
    print(resumo)
    destino = os.environ.get("GITHUB_STEP_SUMMARY")
    if destino:
        with open(destino, "a", encoding="utf-8") as f:
            f.write(resumo)
    return 1 if reprovou else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="comando", required=True)

    p_contar = sub.add_parser("contar")
    p_contar.add_argument("--area", choices=AREAS, required=True)
    p_contar.add_argument("--relatorio", required=True,
                          help="diretório dos XML JUnit (backend) ou JSON do Jest/Vitest")
    p_contar.add_argument("--saida", required=True)

    p_comparar = sub.add_parser("comparar")
    p_comparar.add_argument("--atual", required=True)
    p_comparar.add_argument("--base", default="")
    p_comparar.add_argument("--alterados", required=True,
                            help="arquivo com um caminho alterado por linha")

    args = parser.parse_args()
    if args.comando == "contar":
        contar(args)
        return 0
    return comparar(args)


if __name__ == "__main__":
    sys.exit(main())
