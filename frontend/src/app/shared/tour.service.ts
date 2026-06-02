import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface TourStep {
  /** CSS selector for the element to spotlight. */
  sel: string;
  title: string;
  body: string;
}

/** Drives the optional on-screen guided walkthrough of the Audit Trail screen. */
@Injectable({ providedIn: 'root' })
export class TourService {
  private router = inject(Router);

  readonly steps: TourStep[] = [
    {
      sel: '.page-header .titleblock',
      title: 'The append-only log',
      body: 'Every create, update, and delete is captured automatically at the database layer. This whole screen is that log, and nothing is ever overwritten.',
    },
    {
      sel: '.diff',
      title: 'Field-level diffs',
      body: 'Each entry shows exactly what changed: the field, then old to new, with +/-/~ glyphs and a colored border. Hit Expand on a row to see the unchanged fields too.',
    },
    {
      sel: '.viewswitch',
      title: 'Three ways to read it',
      body: 'Detailed is the full diff. Compact is one line per change. Timeline groups by day. Same history, whichever view fits the moment.',
    },
    {
      sel: '.minitoggle',
      title: 'Unified or side-by-side',
      body: 'Switch the diff between the unified change-row and the classic two-column old vs new layout.',
    },
    {
      sel: '.nav-tools .iconbtn',
      title: 'Light and dark',
      body: 'Toggle the theme here. Your choice is remembered between visits.',
    },
    {
      sel: '.tweak-fab',
      title: 'Make it yours',
      body: 'Accent color, density, diff layout, and showing unchanged fields. All of it saves locally.',
    },
    {
      sel: '.filter-head',
      title: 'Filter and export',
      body: 'Filter by action, author, module, or date, then export exactly what you see to CSV.',
    },
    {
      sel: '.nav-links a[href="/accidents"]',
      title: 'Where the changes come from',
      body: 'Log, edit, and delete incidents on this page. Every change writes an entry on the trail, and a deleted incident can be restored from it.',
    },
  ];

  readonly active = signal(false);
  readonly index = signal(0);
  readonly step = computed(() => this.steps[this.index()]);

  start(): void {
    // The tour narrates the Audit Trail screen, so make sure we're on it first.
    this.router.navigate(['/audit-trail']).then(() => {
      this.index.set(0);
      this.active.set(true);
    });
  }

  next(): void {
    if (this.index() < this.steps.length - 1) this.index.update((i) => i + 1);
    else this.stop();
  }

  prev(): void {
    if (this.index() > 0) this.index.update((i) => i - 1);
  }

  stop(): void {
    this.active.set(false);
  }
}
