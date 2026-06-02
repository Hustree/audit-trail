import { Injectable, computed, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export type Density = 'compact' | 'cozy' | 'comfortable';
export type DiffLayout = 'unified' | 'columns';

export interface Accent {
  hex: string;
  h: number;
  c: number;
  name: string;
}

export const ACCENTS: Accent[] = [
  { hex: '#3a52d6', h: 264, c: 0.17, name: 'Cobalt' },
  { hex: '#1f78c9', h: 235, c: 0.15, name: 'Azure' },
  { hex: '#6b46d9', h: 300, c: 0.17, name: 'Violet' },
  { hex: '#5a6b86', h: 255, c: 0.045, name: 'Slate' },
];

export interface Tweaks {
  theme: Theme;
  density: Density;
  accent: string;
  diffLayout: DiffLayout;
  showUnchanged: boolean;
}

const STORAGE_KEY = 'audit-trail.tweaks';
const DEFAULTS: Tweaks = {
  theme: 'light',
  density: 'cozy',
  accent: '#3a52d6',
  diffLayout: 'unified',
  showUnchanged: false,
};

/** Single source of truth for theme/density/accent/diff preferences, persisted to localStorage. */
@Injectable({ providedIn: 'root' })
export class TweaksService {
  private state = signal<Tweaks>(this.load());

  readonly tweaks = this.state.asReadonly();

  /** The resolved accent for the current selection (drives the --brand-* custom properties). */
  readonly accentObj = computed(
    () => ACCENTS.find((x) => x.hex === this.state().accent) ?? ACCENTS[0],
  );

  set<K extends keyof Tweaks>(key: K, value: Tweaks[K]): void {
    this.state.update((s) => ({ ...s, [key]: value }));
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      /* storage unavailable: keep in-memory only */
    }
  }

  private load(): Tweaks {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...DEFAULTS, ...saved };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
