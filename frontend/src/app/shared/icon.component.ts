import { Component, Input, OnChanges, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Inner SVG markup for each icon (simple geometric strokes), ported from the design handoff. */
const PATHS: Record<string, string> = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  download: '<path d="M12 3v12M7 11l5 4 5-4"/><path d="M5 21h14"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
  moon: '<path d="M21 12.8A8 8 0 1 1 11.2 3 6.2 6.2 0 0 0 21 12.8z"/>',
  alert: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  reset: '<path d="M3 3v6h6"/><path d="M3.5 9a9 9 0 1 1-1.5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  empty: '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
};

/** Inline stroke icon: <app-icon name="shield" [s]="15" />. */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<span class="ico" style="display:inline-flex;line-height:0" [innerHTML]="svg"></span>`,
})
export class IconComponent implements OnChanges {
  private san = inject(DomSanitizer);
  @Input() name = '';
  @Input() s = 16;
  @Input() w = 1.8;
  svg: SafeHtml = '';

  ngOnChanges(): void {
    const inner = PATHS[this.name] ?? '';
    const html =
      `<svg width="${this.s}" height="${this.s}" viewBox="0 0 24 24" fill="none" ` +
      `stroke="currentColor" stroke-width="${this.w}" stroke-linecap="round" ` +
      `stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    this.svg = this.san.bypassSecurityTrustHtml(html);
  }
}
