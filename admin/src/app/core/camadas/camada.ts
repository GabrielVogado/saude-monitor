import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

/** Os 4 slugs de `GET /api/v1/camadas/{tipo}` (E7-04), espelhando `TipoCamada` do backend. */
export type TipoCamada = 'regiao-administrativa' | 'ride' | 'regiao-saude' | 'macrorregiao-saude';

interface GeoJsonFeature {
  properties?: { nome?: string };
}
export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/**
 * Cliente das camadas geográficas públicas (`GET /api/v1/camadas/{tipo}`).
 *
 * Usado pela E7-03 (seletor de Região Administrativa) e pela E7-04 (mapa multi-camada,
 * onde cada `FeatureCollection` é desenhada como um overlay). Não há endpoint dedicado
 * para "listar nomes de região": a camada pública já basta.
 */
@Injectable({ providedIn: 'root' })
export class Camada {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** GeoJSON bruto de uma camada (E7-04) — cache fica por conta do chamador (lazy-load por toggle). */
  buscar(tipo: TipoCamada): Observable<GeoJsonFeatureCollection> {
    return this.http.get<GeoJsonFeatureCollection>(`${this.apiBaseUrl}/api/v1/camadas/${tipo}`);
  }

  /** Nomes distintos de Região Administrativa, ordenados alfabeticamente. */
  nomesRegiaoAdministrativa(): Observable<string[]> {
    return this.buscar('regiao-administrativa').pipe(
      map((fc) =>
        (fc.features ?? [])
          .map((f) => f.properties?.nome)
          .filter((nome): nome is string => !!nome)
          .sort((a, b) => a.localeCompare(b)),
      ),
    );
  }
}
