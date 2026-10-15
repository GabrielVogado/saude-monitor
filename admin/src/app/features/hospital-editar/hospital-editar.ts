import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { HospitalApi } from '../../core/hospitais/hospital';
import {
  CategoriaEstabelecimento,
  GeoJsonPolygon,
  HospitalDetalheResponse,
  HospitalRequest,
  TipoEstabelecimento,
} from '../../core/hospitais/hospital.models';
import {
  Ponto,
  centroide,
  criarCirculo,
  ehCirculoDoProduto,
  raioAproximadoMetros,
} from '../../core/hospitais/geofence';
import { criarMapaBase } from '../../core/mapa/mapa-base';

/** Mesmo formato exigido pelo `@Pattern` do `HospitalRequest.cnpj` no backend. */
const CNPJ_MASCARA = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
/** Registros importados do CNES podem ter o CNPJ gravado só com dígitos. */
const CNPJ_DIGITOS = /^\d{14}$/;
/** UF: duas letras, tolerando espaços nas pontas (o envio faz `trim`). */
const UF_PATTERN = /^\s*[A-Za-z]{2}\s*$/;
/** Faixa aceita para o raio do geofence; os raios de categoria do backend vão de 75 a 150 m. */
export const RAIO_MINIMO_METROS = 30;
export const RAIO_MAXIMO_METROS = 1000;

export const CATEGORIAS: readonly { valor: CategoriaEstabelecimento; rotulo: string }[] = [
  { valor: 'HOSPITAL', rotulo: 'Hospital' },
  { valor: 'UPA', rotulo: 'UPA' },
  { valor: 'UBS', rotulo: 'UBS' },
  { valor: 'POLICLINICA', rotulo: 'Policlínica' },
  { valor: 'CAPS', rotulo: 'CAPS' },
  { valor: 'CENTRO_ESPECIALIZADO', rotulo: 'Centro especializado' },
  { valor: 'OUTRO', rotulo: 'Outro' },
];

/** `''`/espaços viram `null` — o backend valida formato só quando o campo vem preenchido. */
function vazioParaNull(valor: string): string | null {
  const t = valor.trim();
  return t ? t : null;
}

/** Aceita a máscara ou 14 dígitos; os dígitos são enviados já mascarados. */
function formatarCnpj(valor: string): string | null {
  const t = vazioParaNull(valor);
  if (t && CNPJ_DIGITOS.test(t)) {
    return `${t.slice(0, 2)}.${t.slice(2, 5)}.${t.slice(5, 8)}/${t.slice(8, 12)}-${t.slice(12)}`;
  }
  return t;
}

function validarCnpj(c: AbstractControl<string>): ValidationErrors | null {
  const t = (c.value ?? '').trim();
  return !t || CNPJ_MASCARA.test(t) || CNPJ_DIGITOS.test(t) ? null : { cnpj: true };
}

/**
 * Edição dos dados cadastrais e do geofence de um hospital (E7-06).
 *
 * Consome `PUT /api/v1/hospitais/{id}`. O geofence só é regerado quando o administrador
 * muda o raio: sem mexer no raio, o polígono atual vai de volta intacto (inclusive um
 * contorno desenhado à mão, mesmo que o raio medido dele esteja fora da faixa aceita
 * para um raio novo). Indicadores e feedbacks não aparecem nem são enviados (CA da
 * E7-06 e E7-08).
 */
@Component({
  selector: 'app-hospital-editar',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './hospital-editar.html',
  styleUrl: './hospital-editar.scss',
})
export class HospitalEditar implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(HospitalApi);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapaEl = viewChild<ElementRef<HTMLDivElement>>('mapaEl');
  private mapa: L.Map | null = null;
  private destruirMapa: (() => void) | null = null;
  private contorno: L.Polygon | null = null;

  protected readonly categorias = CATEGORIAS;
  protected readonly raioMinimo = RAIO_MINIMO_METROS;
  protected readonly raioMaximo = RAIO_MAXIMO_METROS;

  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly erroCarga = signal<string | null>(null);
  protected readonly erroEnvio = signal<string | null>(null);
  protected readonly detalhesErro = signal<string[]>([]);
  protected readonly hospital = signal<HospitalDetalheResponse | null>(null);

  /** Geofence e medidas como vieram do servidor. */
  private readonly geofenceOriginal = signal<GeoJsonPolygon | null>(null);
  protected readonly centro = signal<Ponto | null>(null);
  protected readonly raioOriginal = signal<number | null>(null);
  /** O original é o círculo de 32 lados do backend — o que a reconciliação redimensiona. */
  private readonly originalEhCirculoDoProduto = signal(false);
  /** Espelhos em signal dos controles que alimentam a prévia e os avisos. */
  private readonly raioDigitado = signal<number | null>(null);
  private readonly categoriaEscolhida = signal<CategoriaEstabelecimento | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(200)]],
    cnpj: ['', [validarCnpj]],
    tipo: this.fb.nonNullable.control<TipoEstabelecimento>('PUBLICO', Validators.required),
    categoria: this.fb.control<CategoriaEstabelecimento | null>(null),
    endereco: this.fb.nonNullable.group({
      logradouro: ['', [Validators.required, Validators.maxLength(300)]],
      numero: [''],
      complemento: [''],
      bairro: [''],
      cidade: ['', [Validators.required, Validators.maxLength(120)]],
      uf: ['', [Validators.required, Validators.pattern(UF_PATTERN)]],
      cep: [''],
    }),
    contato: this.fb.nonNullable.group({
      telefone: ['', [Validators.maxLength(20)]],
      email: ['', [Validators.email, Validators.maxLength(200)]],
    }),
    // A faixa só vale para um raio NOVO: o raio medido do polígono atual pode estar fora
    // dela (contorno desenhado à mão) e isso não pode travar a edição dos outros campos.
    raioMetros: this.fb.control<number | null>(null, [(c) => this.validarRaio(c)]),
  });

  /** O raio mudou para um valor válido — só então o polígono é substituído. */
  protected readonly raioAlterado = computed(() => {
    const digitado = this.raioDigitado();
    return (
      digitado != null &&
      digitado !== this.raioOriginal() &&
      digitado >= RAIO_MINIMO_METROS &&
      digitado <= RAIO_MAXIMO_METROS
    );
  });

  /** Geofence que será enviado no PUT (e desenhado na prévia). */
  protected readonly geofenceAEnviar = computed<GeoJsonPolygon | null>(() => {
    const centro = this.centro();
    const raio = this.raioDigitado();
    if (this.raioAlterado() && centro && raio != null) {
      return criarCirculo(centro, raio);
    }
    return this.geofenceOriginal();
  });

  /**
   * Categoria trocada sem mexer no raio, sobre o círculo gerado pelo backend: a
   * reconciliação de startup vai redimensioná-lo para o raio padrão da nova categoria.
   */
  protected readonly raioSegueCategoria = computed(
    () =>
      !this.raioAlterado() &&
      this.originalEhCirculoDoProduto() &&
      this.categoriaEscolhida() !== (this.hospital()?.categoria ?? null),
  );

  constructor() {
    this.form.controls.raioMetros.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.raioDigitado.set(v == null || Number.isNaN(Number(v)) ? null : Number(v)));
    this.form.controls.categoria.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.categoriaEscolhida.set(v));

    afterRenderEffect(() => {
      const el = this.mapaEl();
      const geofence = this.geofenceAEnviar();
      if (el && geofence) {
        this.desenharPrevia(el.nativeElement, geofence);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.destruirMapa?.();
      this.mapa = null;
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.erroCarga.set('Hospital não informado.');
      this.carregando.set(false);
      return;
    }
    this.api
      .buscarPorId(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (h) => {
          this.preencher(h);
          this.carregando.set(false);
        },
        error: () => {
          this.erroCarga.set('Não foi possível carregar este hospital. Ele pode ter sido removido.');
          this.carregando.set(false);
        },
      });
  }

  protected salvar(): void {
    const h = this.hospital();
    const geofence = this.geofenceAEnviar();
    if (!h || !geofence) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    this.erroEnvio.set(null);
    this.detalhesErro.set([]);

    // Preso ao ciclo de vida: se o usuário sair durante um cold start, a resposta tardia
    // não o arrasta de volta para o detalhe.
    this.api
      .atualizar(h.id, this.montarRequest(geofence))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (atualizado) => {
          this.salvando.set(false);
          this.router.navigate(['/hospitais', atualizado.id]).catch(() => {
            // O PUT já foi gravado: avisa que salvou, em vez de deixar o usuário sem retorno.
            this.erroEnvio.set(
              'Alterações salvas, mas não foi possível abrir o detalhe do hospital. Recarregue a página.',
            );
          });
        },
        error: (e: unknown) => {
          this.salvando.set(false);
          this.tratarErro(e);
        },
      });
  }

  private validarRaio(c: AbstractControl<number | null>): ValidationErrors | null {
    const v = c.value;
    if (v === this.raioOriginal()) {
      return null;
    }
    if (v == null || Number.isNaN(Number(v))) {
      return { required: true };
    }
    return v < RAIO_MINIMO_METROS || v > RAIO_MAXIMO_METROS ? { faixa: true } : null;
  }

  private preencher(h: HospitalDetalheResponse): void {
    this.hospital.set(h);
    const geofence = h.geofence ?? null;
    const centro = geofence ? centroide(geofence) : null;
    const raio = geofence && centro ? raioAproximadoMetros(geofence, centro) : null;
    this.geofenceOriginal.set(geofence);
    this.centro.set(centro);
    this.raioOriginal.set(raio);
    this.originalEhCirculoDoProduto.set(!!geofence && !!centro && ehCirculoDoProduto(geofence, centro));

    this.form.reset({
      nome: h.nome ?? '',
      cnpj: h.cnpj ?? '',
      tipo: h.tipo,
      categoria: h.categoria ?? null,
      endereco: {
        logradouro: h.endereco?.logradouro ?? '',
        numero: h.endereco?.numero ?? '',
        complemento: h.endereco?.complemento ?? '',
        bairro: h.endereco?.bairro ?? '',
        cidade: h.endereco?.cidade ?? '',
        uf: h.endereco?.uf ?? '',
        cep: h.endereco?.cep ?? '',
      },
      contato: {
        telefone: h.contato?.telefone ?? '',
        email: h.contato?.email ?? '',
      },
      raioMetros: raio,
    });
  }

  private montarRequest(geofence: GeoJsonPolygon): HospitalRequest {
    const v = this.form.getRawValue();
    const telefone = vazioParaNull(v.contato.telefone);
    const email = vazioParaNull(v.contato.email);
    return {
      nome: v.nome.trim(),
      cnpj: formatarCnpj(v.cnpj),
      tipo: v.tipo,
      categoria: v.categoria,
      endereco: {
        logradouro: v.endereco.logradouro.trim(),
        numero: vazioParaNull(v.endereco.numero) ?? undefined,
        complemento: vazioParaNull(v.endereco.complemento) ?? undefined,
        bairro: vazioParaNull(v.endereco.bairro) ?? undefined,
        cidade: v.endereco.cidade.trim(),
        uf: v.endereco.uf.trim().toUpperCase(),
        cep: vazioParaNull(v.endereco.cep) ?? undefined,
      },
      contato: telefone || email ? { telefone: telefone ?? undefined, email: email ?? undefined } : null,
      geofence,
    };
  }

  private tratarErro(e: unknown): void {
    if (!(e instanceof HttpErrorResponse)) {
      this.erroEnvio.set('Falha inesperada ao salvar.');
      return;
    }
    if (e.status === 0) {
      this.erroEnvio.set('Não foi possível conectar ao servidor. Tente novamente.');
      return;
    }
    if (e.status === 401 || e.status === 403) {
      this.erroEnvio.set('Sua sessão não tem permissão para editar hospitais. Entre novamente como administrador.');
      return;
    }
    if (e.status === 404) {
      this.erroEnvio.set('Este hospital não existe mais.');
      return;
    }
    const corpo = e.error as { message?: string; details?: { campo?: string; mensagem?: string }[] } | null;
    this.erroEnvio.set(corpo?.message || `Não foi possível salvar (HTTP ${e.status}).`);
    this.detalhesErro.set(
      (corpo?.details ?? []).map((d) => (d.campo ? `${d.campo}: ${d.mensagem ?? ''}` : (d.mensagem ?? ''))),
    );
  }

  /** Desenha o contorno e enquadra o mapa nele (reenquadra a cada mudança de raio). */
  private desenharPrevia(el: HTMLDivElement, geofence: GeoJsonPolygon): void {
    if (!this.mapa) {
      const { mapa, destruir } = criarMapaBase(el);
      this.mapa = mapa;
      this.destruirMapa = destruir;
    }
    this.contorno?.remove();
    const latLngs = geofence.coordinates[0].map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
    this.contorno = L.polygon(latLngs, { color: '#175cd3', weight: 2, fillOpacity: 0.15 }).addTo(this.mapa);
    this.mapa.fitBounds(this.contorno.getBounds(), { padding: [16, 16] });
  }
}
