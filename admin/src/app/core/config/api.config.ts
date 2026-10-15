import { InjectionToken } from '@angular/core';

/**
 * Base da API do backend (Spring Boot). Injetada por token para ser trivial de
 * trocar em teste e, no futuro, por ambiente (`environments/`). Aponta hoje para o
 * backend de desenvolvimento no Cloud Run — ver o provider em `app.config.ts`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
