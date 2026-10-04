#!/usr/bin/env python3
"""Trava de contagem de testes e de cobertura do CI (M-030, M-031).

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

Cobertura total (M-031, decisão do PO em 04/10/2026, "não aceitar como passed com
cobertura abaixo de 90%"): com `--cobertura`, o `contar` grava também a cobertura de
linhas da área, e o `comparar` reprova o PR que altera o código da área e faz a
cobertura dela CAIR em relação à base (ou, na área que já passou de 90%, a leva para
baixo de 90%), com folga de 0,1 ponto para a variação entre execuções. Assim o total só sobe
até a meta, sem travar todo PR enquanto ela não é atingida.
O mínimo de 90% nas linhas que o PR altera é cobrado à parte, pelo diff-cover, no
job de cada área.

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


def cobertura_de_linhas(caminho):
    """Percentual de linhas cobertas, a partir do relatório da área:
    XML do JaCoCo (backend), `coverage-summary.json` do Jest (frontend) ou
    `lcov.info` (admin)."""
    if caminho.endswith(".xml"):
        raiz = ET.parse(caminho).getroot()
        linha = next(c for c in raiz.findall("counter") if c.get("type") == "LINE")
        cobertas, total = int(linha.get("covered")), int(linha.get("covered")) + int(linha.get("missed"))
    elif caminho.endswith(".json"):
        with open(caminho, encoding="utf-8") as f:
            linhas = json.load(f)["total"]["lines"]
        cobertas, total = linhas["covered"], linhas["total"]
    else:
        cobertas = total = 0
        with open(caminho, encoding="utf-8") as f:
            for registro in f:
                if registro.startswith("LH:"):
                    cobertas += int(registro[3:])
                elif registro.startswith("LF:"):
                    total += int(registro[3:])
    if total == 0:
        raise SystemExit(f"Relatório de cobertura sem linhas: {caminho}")
    return round(100 * cobertas / total, 2)


def contar(args):
    if args.area == "backend":
        executados = _contar_junit(args.relatorio)
    else:
        executados = _contar_json_jest(args.relatorio)
    dados = {"area": args.area, "executados": executados}
    if args.cobertura:
        dados["cobertura"] = cobertura_de_linhas(args.cobertura)
    os.makedirs(args.saida, exist_ok=True)
    with open(os.path.join(args.saida, f"{args.area}.json"), "w", encoding="utf-8") as f:
        json.dump(dados, f)
    print(f"{args.area}: {executados} testes executados, cobertura {dados.get('cobertura', '—')}%")


def _ler(diretorio, area):
    """Devolve (executados, cobertura); (None, None) sem arquivo."""
    caminho = os.path.join(diretorio, f"{area}.json") if diretorio else None
    if not caminho or not os.path.isfile(caminho):
        return None, None
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
    return dados["executados"], dados.get("cobertura")


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


META_COBERTURA = 90.0


# Folga para a variação entre execuções: código dependente de tempo (async,
# retentativas, agendamentos) pode cobrir uma linha a mais ou a menos de uma rodada
# para outra sem mudança de código.
TOLERANCIA_COBERTURA = 0.1


def avaliar_cobertura(base, atual, mexeu):
    """Devolve (aprovado, mensagem). Base sem cobertura (CI anterior à M-031)
    só registra; área cujo código o PR não altera também só registra, porque
    qualquer diferença nela é variação entre execuções, não efeito do PR.

    O piso é a cobertura da base, limitado à meta: abaixo de 90% o total não pode
    cair; a partir de 90% só não pode voltar para baixo da meta. Sem esse teto,
    numa área com 95%, código novo coberto a 90% (o mínimo exigido) baixaria o
    total e reprovaria o PR que cumpre a regra do código novo."""
    if atual is None or base is None:
        return True, "só registrada"
    if not mexeu:
        return True, "não alterada: só registrada"
    piso = min(base, META_COBERTURA)
    if atual < piso - TOLERANCIA_COBERTURA:
        if piso == META_COBERTURA:
            return False, "a cobertura total da área ficou abaixo de 90%"
        return False, "a cobertura total da área caiu"
    return True, "ok"


def comparar(args):
    with open(args.alterados, encoding="utf-8") as f:
        arquivos = [linha.strip() for linha in f if linha.strip()]

    linhas = [
        "## Trava de contagem de testes e de cobertura",
        "",
        "| Área | Testes base | Testes PR | Código alterado | Exigência | Resultado "
        "| Cobertura base | Cobertura PR | Resultado |",
        "|------|-----:|---:|:---------------:|-----------|-----------|-----:|---:|-----------|",
    ]
    reprovou = False

    def fmt(valor, sufixo=""):
        return "—" if valor is None else f"{valor}{sufixo}"

    for area in AREAS:
        base, cob_base = _ler(args.base, area)
        atual, cob_atual = _ler(args.atual, area)
        mexeu = alterou_codigo(area, arquivos)
        aprovado, motivo = avaliar(area, base, atual, mexeu)
        cob_ok, cob_motivo = avaliar_cobertura(cob_base, cob_atual, mexeu)
        reprovou |= not (aprovado and cob_ok)
        linhas.append(
            f"| {area} | {fmt(base)} | {fmt(atual)} "
            f"| {'sim' if mexeu else 'não'} | {'subir' if mexeu else 'não cair'} "
            f"| {'✅' if aprovado else '❌'} {motivo} "
            f"| {fmt(cob_base, '%')} | {fmt(cob_atual, '%')} | {'✅' if cob_ok else '❌'} {cob_motivo} |"
        )
        if not aprovado:
            print(f"::error title=Trava de testes ({area})::{motivo} (base {base}, PR {atual})")
        if not cob_ok:
            print(f"::error title=Trava de cobertura ({area})::{cob_motivo} (base {cob_base}%, PR {cob_atual}%)")

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
    p_contar.add_argument("--cobertura", default="",
                          help="relatório de cobertura: XML do JaCoCo, coverage-summary.json ou lcov.info")

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
