import { Component, inject } from '@angular/core';
import { IconComponent } from './icon.component';
import { ToastService, ToastType } from './toast.service';

@Component({
  selector: 'app-toast-stack',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="toast {{ t.type }}" [class.leaving]="t.leaving">
          <span class="ic"><app-icon [name]="iconFor(t.type)" [s]="18" /></span>
          <span class="msg"><b>{{ t.title }}</b>@if (t.msg) {<span>{{ t.msg }}</span>}</span>
          <button class="x" aria-label="Dismiss" (click)="toasts.dismiss(t.id)">
            <app-icon name="x" [s]="14" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastStackComponent {
  toasts = inject(ToastService);

  iconFor(type: ToastType): string {
    return type === 'warn' ? 'alert' : type === 'info' ? 'info' : 'checkCircle';
  }
}
