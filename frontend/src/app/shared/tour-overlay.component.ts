import { Component, HostListener, OnDestroy, effect, inject, signal } from '@angular/core';
import { TourService } from './tour.service';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TIP_W = 320;

/** Spotlight + tooltip overlay for the guided walkthrough. */
@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  template: `
    @if (tour.active()) {
      <div class="tour-block"></div>
      @if (spot(); as s) {
        <div
          class="tour-spot"
          [style.top.px]="s.top"
          [style.left.px]="s.left"
          [style.width.px]="s.width"
          [style.height.px]="s.height"
        ></div>
      }
      <div class="tour-tip" [style.top.px]="tip().top" [style.left.px]="tip().left">
        <div class="tt-step">Step {{ tour.index() + 1 }} of {{ tour.steps.length }}</div>
        <h4>{{ tour.step().title }}</h4>
        <p>{{ tour.step().body }}</p>
        <div class="tt-actions">
          <button class="btn btn-ghost btn-sm" (click)="tour.stop()">Skip</button>
          <span class="spacer"></span>
          @if (tour.index() > 0) {
            <button class="btn btn-sm" (click)="tour.prev()">Back</button>
          }
          <button class="btn btn-primary btn-sm" (click)="tour.next()">
            {{ tour.index() === tour.steps.length - 1 ? 'Done' : 'Next' }}
          </button>
        </div>
      </div>
    }
  `,
})
export class TourOverlayComponent implements OnDestroy {
  tour = inject(TourService);

  spot = signal<Box | null>(null);
  tip = signal<{ top: number; left: number }>({ top: 120, left: 24 });

  private current: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const on = this.tour.active();
      this.tour.index(); // track step changes
      if (!on) {
        this.current = null;
        this.spot.set(null);
        return;
      }
      // Defer so any route/view render settles before we measure.
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.locate(), 60);
    });
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onReflow(): void {
    if (this.tour.active() && this.current) this.measure(this.current);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.tour.active()) return;
    if (e.key === 'Escape') this.tour.stop();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') this.tour.next();
    else if (e.key === 'ArrowLeft') this.tour.prev();
  }

  private locate(): void {
    const el = document.querySelector(this.tour.step().sel) as HTMLElement | null;
    if (!el) {
      // Target not on this view; show the tip centered without a spotlight.
      this.current = null;
      this.spot.set(null);
      this.tip.set({ top: 120, left: Math.max(24, (window.innerWidth - TIP_W) / 2) });
      return;
    }
    this.current = el;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    // Let the smooth scroll settle, then measure.
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.measure(el), 240);
  }

  private measure(el: HTMLElement): void {
    const r = el.getBoundingClientRect();
    const pad = 6;
    this.spot.set({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });

    // Place the tooltip below the target if it fits, else above; clamp horizontally.
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const tipH = 190;
    const below = r.bottom + 14;
    const top = below + tipH < vh ? below : Math.max(14, r.top - tipH - 14);
    const left = Math.min(Math.max(14, r.left), vw - TIP_W - 14);
    this.tip.set({ top, left });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
