import { Injectable, signal } from '@angular/core';

export interface ConfirmConfig {
  tone: 'danger' | 'brand';
  icon: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
}

/** Promise-based styled confirm dialog (replaces native confirm()). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly config = signal<ConfirmConfig | null>(null);
  private resolver: ((v: boolean) => void) | null = null;

  ask(cfg: ConfirmConfig): Promise<boolean> {
    this.config.set(cfg);
    return new Promise<boolean>((resolve) => (this.resolver = resolve));
  }

  confirm(): void {
    this.settle(true);
  }

  cancel(): void {
    this.settle(false);
  }

  private settle(value: boolean): void {
    this.config.set(null);
    const r = this.resolver;
    this.resolver = null;
    r?.(value);
  }
}
