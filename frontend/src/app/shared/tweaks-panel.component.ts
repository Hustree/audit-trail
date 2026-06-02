import { Component, inject, signal } from '@angular/core';
import { IconComponent } from './icon.component';
import { ACCENTS, Density, Theme, TweaksService } from './tweaks.service';

/** Always-available, theme-aware control surface: theme, density, accent, diff layout, show-unchanged. */
@Component({
  selector: 'app-tweaks-panel',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (!open()) {
      <button class="tweak-fab" title="Tweaks" (click)="open.set(true)">
        <app-icon name="sliders" [s]="17" /> Tweaks
      </button>
    } @else {
      <div class="tweak-panel">
        <div class="tweak-hd">
          <b>Tweaks</b>
          <button class="iconbtn" style="background:transparent;border-color:transparent;color:var(--muted)"
                  aria-label="Close" (click)="open.set(false)">
            <app-icon name="x" [s]="16" />
          </button>
        </div>
        <div class="tweak-body">
          <div class="tweak-sect">Appearance</div>

          <div class="tweak-row">
            <span class="tweak-lbl">Theme</span>
            <div class="seg">
              @for (o of themes; track o) {
                <button [class.active]="t.tweaks().theme === o" (click)="t.set('theme', o)">{{ o }}</button>
              }
            </div>
          </div>

          <div class="tweak-row">
            <span class="tweak-lbl">Density</span>
            <div class="seg">
              @for (o of densities; track o) {
                <button [class.active]="t.tweaks().density === o" (click)="t.set('density', o)">{{ o }}</button>
              }
            </div>
          </div>

          <div class="tweak-row">
            <span class="tweak-lbl">Accent</span>
            <div class="swatches">
              @for (a of accents; track a.hex) {
                <button class="swatch" [class.active]="t.tweaks().accent === a.hex"
                        [style.background]="a.hex" [title]="a.name" [attr.aria-label]="a.name"
                        (click)="t.set('accent', a.hex)">
                  @if (t.tweaks().accent === a.hex) { <span class="ck"><app-icon name="check" [s]="13" /></span> }
                </button>
              }
            </div>
          </div>

          <div class="tweak-sect">The diff</div>

          <div class="tweak-row">
            <span class="tweak-lbl">Layout</span>
            <div class="seg">
              <button [class.active]="t.tweaks().diffLayout === 'unified'" (click)="t.set('diffLayout', 'unified')">Unified</button>
              <button [class.active]="t.tweaks().diffLayout === 'columns'" (click)="t.set('diffLayout', 'columns')">Columns</button>
            </div>
          </div>

          <div class="tweak-row inline">
            <span class="tweak-lbl">Show unchanged fields</span>
            <button class="toggle" [class.on]="t.tweaks().showUnchanged" role="switch"
                    [attr.aria-checked]="t.tweaks().showUnchanged"
                    (click)="t.set('showUnchanged', !t.tweaks().showUnchanged)"><i></i></button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TweaksPanelComponent {
  t = inject(TweaksService);
  open = signal(false);

  themes: Theme[] = ['light', 'dark'];
  densities: Density[] = ['compact', 'cozy', 'comfortable'];
  accents = ACCENTS;
}
