import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { Camada, TipoCamada } from '../../core/camadas/camada';
import { HospitalApi } from '../../core/hospitais/hospital';
import { CategoriaEstabelecimento, Hospital } from '../../core/hospitais/hospital.models';
import { criarMapaBase } from '../../core/mapa/mapa-base';

/** Camadas geográficas selecionáveis no painel de controle (E7-04). */
interface OpcaoCamada {
  tipo: TipoCamada;
  rotulo: string;
  /** Cor do contorno — é ele que marca a divisão, o preenchimento só a realça. */
  cor: string;
  /** Espessura do contorno: divisões maiores com traço mais grosso. */
  espessura: number;
  tracejado?: string;
  /** Nome fixo sobre cada área — só nas camadas com poucas áreas, para não poluir. */
  rotuloFixo: boolean;
}

const CAMADAS: readonly OpcaoCamada[] = [
  { tipo: 'regiao-administrativa', rotulo: 'Região Administrativa', cor: '#175cd3', espessura: 2, rotuloFixo: false },
  { tipo: 'ride', rotulo: 'RIDE', cor: '#7839ee', espessura: 2, rotuloFixo: false },
  { tipo: 'regiao-saude', rotulo: 'Região de Saúde', cor: '#0d9488', espessura: 3, rotuloFixo: true },
  {
    tipo: 'macrorregiao-saude',
    rotulo: 'Macrorregião de Saúde',
    cor: '#b42318',
    espessura: 4,
    tracejado: '8 6',
    rotuloFixo: true,
  },
];

/** Camada ligada ao abrir o mapa: sem ela, os pontos ficam soltos sobre o fundo. */
const CAMADA_INICIAL: TipoCamada = 'regiao-administrativa';

/**
 * Preenchimento por área (cicla quando há mais áreas que cores): áreas vizinhas com
 * tons diferentes deixam a divisão visível mesmo onde o contorno some sob o fundo.
 */
const PALETA_AREAS = [
  '#2e90fa', '#f79009', '#12b76a', '#ee46bc', '#7a5af8', '#f04438',
  '#06aed4', '#669f2a', '#ef6820', '#6172f3', '#dd2590', '#15b79e',
] as const;

/**
 * Categorias de estabelecimento, na mesma divisão das camadas de pontos da base
 * `multiplas_camadas_saude_14` (Hospitais, UPA, UBS, Policlínicas, CAPS, Centros
 * Especializados, Outras Unidades) que alimentou o seed — cada uma com cor e toggle.
 */
interface OpcaoCategoria {
  categoria: CategoriaEstabelecimento;
  rotulo: string;
  cor: string;
}

export const CATEGORIAS_MAPA: readonly OpcaoCategoria[] = [
  { categoria: 'HOSPITAL', rotulo: 'Hospitais', cor: '#d92d20' },
  { categoria: 'UPA', rotulo: 'UPA', cor: '#dc6803' },
  { categoria: 'UBS', rotulo: 'UBS', cor: '#1570ef' },
  { categoria: 'POLICLINICA', rotulo: 'Policlínicas', cor: '#7f56d9' },
  { categoria: 'CAPS', rotulo: 'CAPS', cor: '#eaaa08' },
  { categoria: 'CENTRO_ESPECIALIZADO', rotulo: 'Centros especializados', cor: '#099250' },
  { categoria: 'OUTRO', rotulo: 'Outras unidades', cor: '#475467' },
];

/** Hospital sem categoria gravada cai em "Outras unidades". */
function categoriaDe(h: Hospital): CategoriaEstabelecimento {
  return h.categoria ?? 'OUTRO';
}

const COR_INATIVO = '#98a2b3';

/**
 * Pane próprio para os marcadores, acima das áreas (overlayPane, z 400): sem ele, uma
 * camada ligada depois dos marcadores era desenhada por cima deles e roubava o clique.
 */
const PANE_HOSPITAIS = 'hospitais';

/** Centro aproximado do Distrito Federal — todo o catálogo de hospitais fica nessa área. */
const CENTRO_DF: L.LatLngTuple = [-15.79, -47.88];
const ZOOM_INICIAL = 10;

/**
 * Mapa multi-camada do painel (E7-04) com marcadores de hospital que levam ao
 * detalhe (E7-05). Leaflet + tiles raster OSM — decisão e limites em ADR-014.
 */
@Component({
  selector: 'app-mapa',
  imports: [],
  templateUrl: './mapa.html',
  styleUrl: './mapa.scss',
})
export class Mapa implements AfterViewInit, OnDestroy {
  @ViewChild('mapaEl', { static: true }) private readonly mapaEl!: ElementRef<HTMLDivElement>;

  private readonly camadaApi = inject(Camada);
  private readonly hospitalApi = inject(HospitalApi);
  private readonly router = inject(Router);

  private mapa: L.Map | null = null;
  /** Cache das camadas já buscadas — evita rebuscar ao alternar o toggle (mitigação T-W1). */
  private readonly camadasCarregadas = new Map<TipoCamada, L.GeoJSON>();
  /** Marcadores agrupados por categoria, para ligar/desligar cada grupo. */
  private readonly gruposCategoria = new Map<CategoriaEstabelecimento, L.LayerGroup>();
  /** Limpeza do mapa base (observer de tamanho + `remove()`), ver `criarMapaBase`. */
  private destruirMapa: (() => void) | null = null;

  protected readonly opcoesCamada = CAMADAS;
  protected readonly opcoesCategoria = CATEGORIAS_MAPA;
  protected readonly corInativo = COR_INATIVO;
  protected readonly camadasAtivas = signal<ReadonlySet<TipoCamada>>(new Set());
  protected readonly categoriasOcultas = signal<ReadonlySet<CategoriaEstabelecimento>>(new Set());
  protected readonly carregandoCamada = signal<TipoCamada | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly totalHospitais = signal(0);
  protected readonly contagemPorCategoria = signal<ReadonlyMap<CategoriaEstabelecimento, number>>(new Map());
  protected readonly haInativos = signal(false);
  protected readonly totalVisiveis = computed(() => {
    const ocultas = this.categoriasOcultas();
    let total = 0;
    for (const [categoria, n] of this.contagemPorCategoria()) {
      if (!ocultas.has(categoria)) {
        total += n;
      }
    }
    return total;
  });

  ngAfterViewInit(): void {
    const { mapa, destruir } = criarMapaBase(this.mapaEl.nativeElement);
    this.mapa = mapa.setView(CENTRO_DF, ZOOM_INICIAL);
    this.mapa.createPane(PANE_HOSPITAIS).style.zIndex = '450';
    this.destruirMapa = destruir;
    this.alternarCamada(CAMADA_INICIAL, true);
    this.carregarHospitais();
  }

  ngOnDestroy(): void {
    this.destruirMapa?.();
    this.mapa = null;
  }

  protected contagem(categoria: CategoriaEstabelecimento): number {
    return this.contagemPorCategoria().get(categoria) ?? 0;
  }

  /** Liga/desliga uma camada geográfica (checkbox). Busca só na primeira vez (lazy-load). */
  protected alternarCamada(tipo: TipoCamada, ligar: boolean): void {
    const ativas = new Set(this.camadasAtivas());
    if (ligar) {
      ativas.add(tipo);
    } else {
      ativas.delete(tipo);
    }
    this.camadasAtivas.set(ativas);

    if (!ligar) {
      const layer = this.camadasCarregadas.get(tipo);
      if (layer && this.mapa) {
        this.mapa.removeLayer(layer);
      }
      return;
    }

    const jaCarregada = this.camadasCarregadas.get(tipo);
    if (jaCarregada) {
      jaCarregada.addTo(this.mapa!);
      return;
    }

    this.carregandoCamada.set(tipo);
    this.erro.set(null);
    this.camadaApi.buscar(tipo).subscribe({
      next: (geojson) => {
        const layer = this.criarCamada(CAMADAS.find((c) => c.tipo === tipo)!, geojson as GeoJSON.GeoJsonObject);
        this.camadasCarregadas.set(tipo, layer);
        // O toggle pode ter sido desmarcado enquanto a chamada estava em voo.
        if (this.camadasAtivas().has(tipo) && this.mapa) {
          layer.addTo(this.mapa);
        }
        this.carregandoCamada.set(null);
      },
      error: () => {
        this.carregandoCamada.set(null);
        this.erro.set(`Não foi possível carregar a camada "${CAMADAS.find((c) => c.tipo === tipo)?.rotulo}".`);
        const ativasAtual = new Set(this.camadasAtivas());
        ativasAtual.delete(tipo);
        this.camadasAtivas.set(ativasAtual);
      },
    });
  }

  /** Mostra/esconde os marcadores de uma categoria (legenda). */
  protected alternarCategoria(categoria: CategoriaEstabelecimento, mostrar: boolean): void {
    const ocultas = new Set(this.categoriasOcultas());
    if (mostrar) {
      ocultas.delete(categoria);
    } else {
      ocultas.add(categoria);
    }
    this.categoriasOcultas.set(ocultas);

    const grupo = this.gruposCategoria.get(categoria);
    if (!grupo || !this.mapa) {
      return;
    }
    if (mostrar) {
      grupo.addTo(this.mapa);
    } else {
      this.mapa.removeLayer(grupo);
    }
  }

  /**
   * Cada área com contorno forte na cor da camada e preenchimento próprio; o nome aparece
   * ao passar o mouse (e fixo nas camadas de poucas áreas), com a área realçada.
   */
  private criarCamada(opcao: OpcaoCamada, geojson: GeoJSON.GeoJsonObject): L.GeoJSON {
    let indice = 0;
    const estiloBase = new WeakMap<L.Layer, L.PathOptions>();
    return L.geoJSON(geojson, {
      style: () => {
        const estilo: L.PathOptions = {
          color: opcao.cor,
          weight: opcao.espessura,
          opacity: 0.9,
          dashArray: opcao.tracejado,
          fillColor: PALETA_AREAS[indice % PALETA_AREAS.length],
          fillOpacity: 0.18,
        };
        indice++;
        return estilo;
      },
      onEachFeature: (feature, layer) => {
        const nome = (feature.properties as { nome?: string } | null)?.nome;
        if (!nome) {
          return;
        }
        layer.bindTooltip(escaparHtml(nome), {
          permanent: opcao.rotuloFixo,
          sticky: !opcao.rotuloFixo,
          direction: 'center',
          className: 'rotulo-area',
        });
        const caminho = layer as L.Path;
        layer.on({
          mouseover: () => {
            estiloBase.set(layer, { ...caminho.options });
            caminho.setStyle({ weight: opcao.espessura + 2, fillOpacity: 0.3 });
          },
          mouseout: () => {
            const base = estiloBase.get(layer);
            if (base) {
              caminho.setStyle(base);
            }
          },
        });
      },
    });
  }

  /** Maior `size` aceito pelo backend (`@Max(100)` em `AdminHospitalController`). */
  private static readonly TAMANHO_PAGINA = 100;

  /**
   * Busca todas as páginas até completar o catálogo (~340 hospitais hoje) — o backend
   * limita `size` a 100 por chamada, então uma página só não cobriria o mapa inteiro.
   * Mesmo padrão já usado no app mobile para a listagem "Todos" (E1-03).
   */
  private carregarHospitais(pagina = 0, acumulado: Hospital[] = []): void {
    this.hospitalApi.listar({ status: 'TODOS', page: pagina, size: Mapa.TAMANHO_PAGINA }).subscribe({
      next: (r) => {
        const todos = [...acumulado, ...r.content];
        if (pagina + 1 < r.totalPages) {
          this.carregarHospitais(pagina + 1, todos);
          return;
        }
        this.totalHospitais.set(r.totalElements);
        this.desenharMarcadores(todos);
      },
      error: () => this.erro.set('Não foi possível carregar os hospitais no mapa.'),
    });
  }

  private desenharMarcadores(hospitais: Hospital[]): void {
    if (!this.mapa) {
      return;
    }
    const contagem = new Map<CategoriaEstabelecimento, number>();
    let haInativos = false;
    for (const h of hospitais) {
      if (!h.localizacao) {
        continue; // hospital sem centroide calculado — nada a desenhar
      }
      const categoria = categoriaDe(h);
      const cor = CATEGORIAS_MAPA.find((c) => c.categoria === categoria)?.cor ?? COR_INATIVO;
      haInativos ||= !h.ativo;
      contagem.set(categoria, (contagem.get(categoria) ?? 0) + 1);

      const marcador = L.circleMarker([h.localizacao.latitude, h.localizacao.longitude], {
        pane: PANE_HOSPITAIS,
        radius: categoria === 'HOSPITAL' || categoria === 'UPA' ? 7 : 5.5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: h.ativo ? cor : COR_INATIVO,
        fillOpacity: h.ativo ? 0.95 : 0.7,
      });
      marcador.bindTooltip(escaparHtml(h.nome), { direction: 'top', offset: [0, -6] });
      marcador.bindPopup(this.criarConteudoPopup(h));
      this.grupo(categoria).addLayer(marcador);
    }
    this.contagemPorCategoria.set(contagem);
    this.haInativos.set(haInativos);
  }

  /** Grupo da categoria, criado sob demanda e já no mapa se a categoria estiver visível. */
  private grupo(categoria: CategoriaEstabelecimento): L.LayerGroup {
    let grupo = this.gruposCategoria.get(categoria);
    if (!grupo) {
      grupo = L.layerGroup();
      this.gruposCategoria.set(categoria, grupo);
      if (!this.categoriasOcultas().has(categoria) && this.mapa) {
        grupo.addTo(this.mapa);
      }
    }
    return grupo;
  }

  /**
   * Monta o conteúdo do popup do marcador (E7-05): resumo + botão "Ver detalhes".
   * Isolado de `desenharMarcadores` para ser testável sem depender do ciclo de vida
   * de popup do Leaflet (que só anexa o elemento ao DOM quando o popup é aberto).
   */
  protected criarConteudoPopup(h: Hospital): HTMLElement {
    const categoria = CATEGORIAS_MAPA.find((c) => c.categoria === categoriaDe(h))?.rotulo;
    const container = document.createElement('div');
    container.className = 'text-sm';
    container.innerHTML = `
      <p class="font-semibold">${escaparHtml(h.nome)}</p>
      <p class="text-ink-soft">${categoria ? `${escaparHtml(categoria)} · ` : ''}${h.tipo === 'PUBLICO' ? 'Público' : 'Privado'} · ${h.ativo ? 'Ativo' : 'Inativo'}</p>
      ${h.regiaoAdministrativa ? `<p class="text-ink-soft">${escaparHtml(h.regiaoAdministrativa)}</p>` : ''}
    `;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = 'Ver detalhes';
    botao.className = 'mt-2 text-brand-500 font-semibold hover:underline';
    botao.addEventListener('click', () => this.router.navigate(['/hospitais', h.id]));
    container.appendChild(botao);
    return container;
  }
}

/** Evita que nome/região de um hospital com HTML no texto quebre o popup (XSS defensivo). */
function escaparHtml(texto: string): string {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}
