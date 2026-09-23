# Fonte do icone "Radar Saude" — pin de localizacao com cruz de saude vazada
# (pontas arredondadas, de proposito distinta do simbolo do SUS) + duas ondas de
# radar acima, na cor de marca do app (#006193).
#
# Sem chave de API de geracao de imagem configurada no ambiente (Gemini/MuAPI) no
# momento em que este icone foi criado — desenhado a mao em SVG e rasterizado via
# Chrome headless, sem depender de nenhuma API externa.
#
# Como regenerar (ex.: apos mudar cor de marca ou ajustar o glifo):
#   1. python gerar_icone.py            # escreve os 4 .html neste diretorio
#   2. Rasterizar cada .html em 1024x1024 via Chrome headless, ex.:
#      chrome --headless=new --disable-gpu --window-size=1024,1024 \
#             --default-background-color=00000000 --screenshot=saida.png arquivo.html
#      (o --default-background-color=00000000 preserva transparencia real no PNG)
#   3. Redimensionar full/fg/bg/mono para os tamanhos de
#      frontend/android/app/src/main/res/mipmap-*/ (mdpi 108/hdpi 162/xhdpi 216/
#      xxhdpi 324/xxxhdpi 432 para as camadas adaptativas; 48/72/96/144/192 para
#      os icones legados ic_launcher(.round).webp) e para
#      frontend/assets/{icon,android-icon-foreground,-background,-monochrome}.png
#
# NAO rodar `expo prebuild`: o android/ deste projeto e mantido a mao (ver
# FRONTEND-ANDROID-SUBIDA-EMULADOR-SEM-GARGALO.md, nao versionado) — os mipmaps
# tem que ser atualizados diretamente, como neste processo.

import math
import os

# Glifo: pin de localizacao (com cruz de saude dentro) + duas ondas de radar acima.
# Conceito: o app "detecta" (radar) sua chegada a um ponto de saude (pin + cruz).

def arco(cx, cy, r, ang_ini_graus, ang_fim_graus):
    a0 = math.radians(ang_ini_graus)
    a1 = math.radians(ang_fim_graus)
    x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
    x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
    return f"M {x0:.2f} {y0:.2f} A {r} {r} 0 0 1 {x1:.2f} {y1:.2f}"


CX, CY = 50, 52  # centro da cabeca do pin / centro das ondas de radar

ARCO1 = arco(CX, CY, 26, 200, 340)
ARCO2 = arco(CX, CY, 37, 200, 340)

PIN = (
    f"M {CX} 90 "
    f"C 38 74 {CX-20} 66 {CX-20} {CY} "
    f"A 20 20 0 1 1 {CX+20} {CY} "
    f"C {CX+20} 66 62 74 {CX} 90 Z"
)

# Cruz com pontas arredondadas (mais acolhedora, menos institucional/militar) —
# recortada do pin via <mask>, nao via path reto, para poder arredondar (rx).
CRUZ_MASK_ID = "cruzMask"


def glifo_svg(cor_pin: str, cor_ondas: str, com_cruz: bool, escala: float = 1.0) -> str:
    # Escala em torno do centro do glifo para caber na "zona segura" (~66%) do
    # icone adaptativo do Android sem cortar pontas em mascaras circulares.
    transform = f'transform="translate({CX} {CY}) scale({escala}) translate({-CX} {-CY})"'
    mask_def = f'''
    <mask id="{CRUZ_MASK_ID}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect x="0" y="0" width="100" height="100" fill="white"/>
      <rect x="{CX-4}" y="{CY-11}" width="8" height="22" rx="3.2" fill="black"/>
      <rect x="{CX-11}" y="{CY-4}" width="22" height="8" rx="3.2" fill="black"/>
    </mask>
    ''' if com_cruz else ""
    mask_attr = f'mask="url(#{CRUZ_MASK_ID})"' if com_cruz else ""
    return f'''
    <defs>{mask_def}</defs>
    <g {transform}>
    <path d="{ARCO2}" stroke="{cor_ondas}" stroke-width="5.5" stroke-linecap="round" fill="none" opacity="0.55"/>
    <path d="{ARCO1}" stroke="{cor_ondas}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.85"/>
    <path d="{PIN}" fill="{cor_pin}" {mask_attr}/>
    </g>
    '''


def pagina(conteudo_svg: str) -> str:
    # Fundo da PAGINA sempre "transparent": quem decide a transparencia real do
    # PNG rasterizado e a flag --default-background-color=00000000 do Chrome
    # (passo 2 do cabecalho), nao este CSS — nao ha variacao a parametrizar aqui.
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{{margin:0;padding:0;width:1024px;height:1024px;background:transparent;}}
    svg{{display:block;width:1024px;height:1024px;}}
    </style></head><body>
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {conteudo_svg}
    </svg>
    </body></html>'''


OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

TEAL = "#006193"
BRANCO = "#ffffff"

# 1) icon-full: fundo solido + glifo branco (icone nao-adaptativo / web favicon)
#    Sem recorte de mascara do SO aqui, entao cabe uma escala maior (so uma margem
#    de respiro dentro do rounded-square).
fundo_full = f'<rect x="0" y="0" width="100" height="100" rx="22" fill="{TEAL}"/>'
full = pagina(fundo_full + glifo_svg(BRANCO, BRANCO, True, escala=0.92))
open(f"{OUT}/icon-full.html", "w", encoding="utf-8").write(full)

# 2) foreground: transparente, glifo branco (fica sobre o background solido do adaptive icon)
#    Escala menor: "zona segura" (~66%) do icone adaptativo do Android, para nao
#    cortar pontas em mascaras circulares/squircle.
fg = pagina(glifo_svg(BRANCO, BRANCO, True, escala=0.8))
open(f"{OUT}/icon-foreground.html", "w", encoding="utf-8").write(fg)

# 3) background: preenchimento solido (camada de baixo do adaptive icon)
bg_conteudo = f'<rect x="0" y="0" width="100" height="100" fill="{TEAL}"/>'
bg = pagina(bg_conteudo)
open(f"{OUT}/icon-background.html", "w", encoding="utf-8").write(bg)

# 4) monochrome: transparente, silhueta branca so do glifo (Android 13+ themed icon)
#    Mesma zona segura do foreground.
mono = pagina(glifo_svg(BRANCO, BRANCO, True, escala=0.8))
open(f"{OUT}/icon-monochrome.html", "w", encoding="utf-8").write(mono)

print("arquivos gerados em", OUT)
