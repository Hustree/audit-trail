import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'audit-trail', pathMatch: 'full' },
  {
    path: 'accidents',
    loadComponent: () =>
      import('./pages/accidents/accidents.component').then((m) => m.AccidentsComponent),
  },
  {
    path: 'audit-trail',
    loadComponent: () =>
      import('./pages/audit-trail/audit-trail.component').then((m) => m.AuditTrailComponent),
  },
  { path: '**', redirectTo: 'audit-trail' },
];
