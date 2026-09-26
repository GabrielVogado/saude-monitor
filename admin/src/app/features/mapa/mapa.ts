import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { Camada, TipoCamada } from '../../core/camadas/camada';
import { HospitalApi } from '../../core/hospitais/hospital';
import { Hospital } from '../../core/hospitais/hospital.models';

/** Camadas selecionáveis no painel de controle (E7-04). */
interface OpcaoCamada {
  tipo: TipoCamada;
  rotulo: string;
  cor: string;
}

const CAMADAS: readonly OpcaoCamada[] = [
  { tipo: 'regiao-administrativa', rotulo: 'Região Administrativa', cor: '#175cd3' },
  { tipo: 'ride', rotulo: 'RIDE', cor: '#7839ee' },
  { tipo: 'regiao-saude', rotulo: 'Região de Saúde', cor: '#0d9488' },
  { tipo: 'macrorregiao-saude', rotulo: 'Macrorregião de Saúde', cor: '#b42318' },
];

/** Centro aproximado do Distrito Federal — todo o catálogo de hospitais fica nessa área. */
const CENTRO_DF: L.LatLngTuple = [-15.79, -47.88];
const ZOOM_INICIAL = 10;
/** O `tile.openstreetmap.org` só publica até z19 (ver BUG-06, ADR-014) — pedir mais 404. */
const ZOOM_MAXIMO = 19;

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

  protected readonly opcoesCamada = CAMADAS;
  protected readonly camadasAtivas = signal<ReadonlySet<TipoCamada>>(new Set());
  protected readonly carregandoCamada = signal<TipoCamada | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly totalHospitais = signal(0);

  ngAfterViewInit(): void {
    this.mapa = L.map(this.mapaEl.nativeElement).setView(CENTRO_DF, ZOOM_INICIAL);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: ZOOM_MAXIMO,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.mapa);
    this.carregarHospitais();
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
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
        const opcao = CAMADAS.find((c) => c.tipo === tipo)!;
        const layer = L.geoJSON(geojson as GeoJSON.GeoJsonObject, {
          style: { color: opcao.cor, weight: 1.5, fillOpacity: 0.08 },
        });
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
    for (const h of hospitais) {
      if (!h.localizacao) {
        continue; // hospital sem centroide calculado — nada a desenhar
      }
      const marcador = L.circleMarker([h.localizacao.latitude, h.localizacao.longitude], {
        radius: 6,
        color: h.ativo ? '#0d9488' : '#6f7881',
        fillColor: h.ativo ? '#0d9488' : '#6f7881',
        fillOpacity: 0.85,
      }).addTo(this.mapa);

      marcador.bindPopup(this.criarConteudoPopup(h));
    }
  }

  /**
   * Monta o conteúdo do popup do marcador (E7-05): resumo + botão "Ver detalhes".
   * Isolado de `desenharMarcadores` para ser testável sem depender do ciclo de vida
   * de popup do Leaflet (que só anexa o elemento ao DOM quando o popup é aberto).
   */
  protected criarConteudoPopup(h: Hospital): HTMLElement {
    const container = document.createElement('div');
    container.className = 'text-sm';
    container.innerHTML = `
      <p class="font-semibold">${escaparHtml(h.nome)}</p>
      <p class="text-ink-soft">${h.tipo === 'PUBLICO' ? 'Público' : 'Privado'} · ${h.ativo ? 'Ativo' : 'Inativo'}</p>
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
