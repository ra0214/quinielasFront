import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'clientes' },
  {
    path: 'clientes',
    loadComponent: () =>
      import('./pages/clientes/clientes.page').then((m) => m.ClientesPage),
  },
  {
    path: 'ediciones',
    loadComponent: () =>
      import('./pages/ediciones/ediciones.page').then((m) => m.EdicionesPage),
  },
  {
    path: 'quinielas',
    loadComponent: () =>
      import('./pages/quinielas/quinielas.page').then((m) => m.QuinielasPage),
  },
  {
    path: 'saldos',
    loadComponent: () =>
      import('./pages/saldos/saldos.page').then((m) => m.SaldosPage),
  },
  {
    path: 'aportes',
    loadComponent: () =>
      import('./pages/aportes/aportes.page').then((m) => m.AportesPage),
  },
  {
    path: 'movimientos',
    loadComponent: () =>
      import('./pages/movimientos/movimientos.page').then((m) => m.MovimientosPage),
  },

  {
    path: 'premios',
    loadComponent: () =>
      import('./pages/premios/premios.page').then((m) => m.PremiosPage),
  },
  {
    path: 'anuncio',
    loadComponent: () =>
      import('./pages/anuncio/anuncio.page').then((m) => m.AnuncioPage),
  },
  { path: '**', redirectTo: 'clientes' },
];
