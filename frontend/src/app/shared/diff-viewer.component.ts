import { Component, Input, OnChanges, signal } from '@angular/core';
import { IconComponent } from './icon.component';
import { DiffField, GLYPH, computeDiff, fmtVal } from './diff.util';
import { DiffLayout } from './tweaks.service';

interface ColLine {
  key: string;
  val: string;
  cls: string;
}

/** The signature component: unified change-row hero + classic two-column variant. */
@Component({
  selector: 'app-diff-viewer',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div>
      <div class="diff-clamp" [class.open]="open()">
        @if (layout === 'columns') {
          <div class="diff-cols">
            <div class="col">
              <div class="col-head" style="color: var(--neg-fg)"><app-icon name="x" [s]="12" /> Old</div>
              @if (oldPresent) {
                @for (l of oldLines; track l.key) {
                  <div class="jline {{ l.cls }}"><span class="jk">{{ l.key }}:</span><span class="jv">{{ l.val }}</span></div>
                }
              } @else {
                <div class="na">no snapshot (N/A)</div>
              }
            </div>
            <div class="col">
              <div class="col-head" style="color: var(--pos-fg)"><app-icon name="check" [s]="12" /> New</div>
              @if (newPresent) {
                @for (l of newLines; track l.key) {
                  <div class="jline {{ l.cls }}"><span class="jk">{{ l.key }}:</span><span class="jv">{{ l.val }}</span></div>
                }
              } @else {
                <div class="na">no snapshot (N/A)</div>
              }
            </div>
          </div>
        } @else {
          <div class="diff">
            @for (f of visibleFields; track f.key) {
              <div class="dline {{ f.status }}">
                <span class="glyph" aria-hidden="true">{{ glyph(f.status) }}</span>
                <span class="dkey">{{ f.key }}</span>
                <span class="dval">
                  @switch (f.status) {
                    @case ('added') { <span class="chip new">{{ val(f.new) }}</span> }
                    @case ('removed') { <span class="chip old">{{ val(f.old) }}</span> }
                    @case ('changed') {
                      <span class="chip old">{{ val(f.old) }}</span>
                      <span class="arrow" aria-hidden="true">→</span>
                      <span class="chip new">{{ val(f.new) }}</span>
                    }
                    @default { <span class="chip plain">{{ val(f.new) }}</span> }
                  }
                </span>
              </div>
            }
          </div>
        }
      </div>
      <div class="diff-cellfoot">
        <div class="summary">
          @if (counts.added > 0) { <span class="tally add">+{{ counts.added }} added</span> }
          @if (counts.removed > 0) { <span class="tally rem">−{{ counts.removed }} removed</span> }
          @if (counts.changed > 0) { <span class="tally chg">~{{ counts.changed }} changed</span> }
          @if (counts.same > 0) { <span class="muted">{{ counts.same }} unchanged</span> }
        </div>
        <span class="spacer"></span>
        <button class="link-btn" (click)="open.set(!open())">
          <app-icon [name]="open() ? 'chevronDown' : 'chevron'" [s]="13" />
          {{ open() ? 'Collapse' : 'Expand' }}
        </button>
      </div>
    </div>
  `,
})
export class DiffViewerComponent implements OnChanges {
  @Input() oldData: Record<string, unknown> | null = null;
  @Input() newData: Record<string, unknown> | null = null;
  @Input() layout: DiffLayout = 'unified';
  @Input() showUnchanged = false;

  open = signal(false);

  visibleFields: DiffField[] = [];
  counts = { added: 0, removed: 0, changed: 0, same: 0 };
  oldPresent = false;
  newPresent = false;
  oldLines: ColLine[] = [];
  newLines: ColLine[] = [];

  ngOnChanges(): void {
    const { fields, counts } = computeDiff(this.oldData, this.newData);
    this.counts = counts;
    this.visibleFields = this.showUnchanged ? fields : fields.filter((f) => f.status !== 'same');
    this.oldPresent = this.oldData != null;
    this.newPresent = this.newData != null;
    this.oldLines = this.buildCol('old');
    this.newLines = this.buildCol('new');
  }

  private buildCol(side: 'old' | 'new'): ColLine[] {
    return this.visibleFields
      .filter((f) => (side === 'old' ? f.hasO : f.hasN))
      .map((f) => {
        const changed =
          f.status === 'changed' || (side === 'old' ? f.status === 'removed' : f.status === 'added');
        const cls = changed ? `is-${side}` : f.status === 'same' ? 'is-same' : '';
        return { key: f.key, val: fmtVal(side === 'old' ? f.old : f.new), cls };
      });
  }

  glyph(status: string): string {
    return GLYPH[status as keyof typeof GLYPH] ?? '';
  }

  val(v: unknown): string {
    return fmtVal(v);
  }
}
