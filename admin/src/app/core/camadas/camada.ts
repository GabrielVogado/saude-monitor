import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

interface GeoJsonFeature {
  properties?: { nome?: string };
}
interface GeoJsonFeatureCollection {
  features: GeoJsonFeature[];
}

/**
 * Cliente das camadas geográficas públicas (`GET /api/v1/camadas/{tipo}`).
 *
 * Usado pela E7-03 para popular o seletor de **Região Administrativa** com os nomes que
 * já vêm em `properties.nome` de cada polígono — a mesma camada que o backend usa (via
 * `RegiaoAdministrativaResolver`, point-in-polygon) para resolver a região de um hospital.
 * Não há endpoint dedicado para "listar nomes de região": a camada pública já basta.
 */
@Injectable({ providedIn: 'root' })
export class Camada {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Nomes distintos de Região Administrativa, ordenados alfabeticamente. */
  nomesRegiaoAdministrativa(): Observable<string[]> {
    return this.http
      .get<GeoJsonFeatureCollection>(`${this.apiBaseUrl}/api/v1/camadas/regiao-administrativa`)
      .pipe(
        map((fc) =>
          (fc.features ?? [])
            .map((f) => f.properties?.nome)
            .filter((nome): nome is string => !!nome)
            .sort((a, b) => a.localeCompare(b)),
        ),
      );
  }
}
