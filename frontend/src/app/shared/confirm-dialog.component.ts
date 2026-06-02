import { Component, HostListener, inject } from '@angular/core';
import { IconComponent } from './icon.component';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (svc.config(); as c) {
      <div class="dialog-backdrop" (mousedown)="onBackdrop($event)">
        <div class="dialog" role="alertdialog" aria-modal="true" [attr.aria-label]="c.title">
          <div class="d-body">
            <div class="d-icon {{ c.tone }}"><app-icon [name]="c.icon" [s]="20" /></div>
            <div>
              <h3>{{ c.title }}</h3>
              <p>{{ c.body }}</p>
            </div>
          </div>
          <div class="d-actions">
            <button class="btn" (click)="svc.cancel()">{{ c.cancelLabel || 'Cancel' }}</button>
            <button
              class="btn {{ c.tone === 'danger' ? 'btn-danger' : 'btn-primary' }}"
              (click)="svc.confirm()"
            >
              {{ c.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  svc = inject(ConfirmService);

  onBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.svc.cancel();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.svc.config()) return;
    if (e.key === 'Escape') this.svc.cancel();
    if (e.key === 'Enter') this.svc.confirm();
  }
}
