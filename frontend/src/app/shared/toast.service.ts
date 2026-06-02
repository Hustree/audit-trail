import { Injectable, signal } from '@angular/core';

export type ToastType = 'ok' | 'info' | 'warn';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  msg?: string;
  leaving?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<Toast[]>([]);
  private seq = 0;

  notify(t: { type?: ToastType; title: string; msg?: string; duration?: number }): void {
    const id = 't' + ++this.seq;
    const item: Toast = { id, type: t.type ?? 'ok', title: t.title, msg: t.msg };
    this.items.update((xs) => [...xs, item]);
    const dur = t.duration ?? 3400;
    setTimeout(() => this.leave(id), dur);
  }

  dismiss(id: string): void {
    this.items.update((xs) => xs.filter((x) => x.id !== id));
  }

  private leave(id: string): void {
    this.items.update((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => this.dismiss(id), 220);
  }
}
