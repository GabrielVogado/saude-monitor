import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'hospitais',
        loadComponent: () => import('./features/hospitais/hospitais').then((m) => m.Hospitais),
      },
      {
        path: 'hospitais/:id',
        loadComponent: () =>
          import('./features/hospital-detalhe/hospital-detalhe').then((m) => m.HospitalDetalhe),
      },
      {
        path: 'hospitais/:id/editar',
        loadComponent: () =>
          import('./features/hospital-editar/hospital-editar').then((m) => m.HospitalEditar),
      },
      {
        path: 'mapa',
        loadComponent: () => import('./features/mapa/mapa').then((m) => m.Mapa),
      },
      {
        path: 'sugestoes',
        loadComponent: () => import('./features/sugestoes/sugestoes').then((m) => m.Sugestoes),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
