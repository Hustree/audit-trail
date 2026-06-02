import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from './shared/icon.component';
import { ToastStackComponent } from './shared/toast-stack.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';
import { TweaksPanelComponent } from './shared/tweaks-panel.component';
import { TweaksService } from './shared/tweaks.service';
import { TourOverlayComponent } from './shared/tour-overlay.component';
import { TourService } from './shared/tour.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    ToastStackComponent,
    ConfirmDialogComponent,
    TweaksPanelComponent,
    TourOverlayComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  t = inject(TweaksService);
  tour = inject(TourService);

  toggleTheme(): void {
    this.t.set('theme', this.t.tweaks().theme === 'dark' ? 'light' : 'dark');
  }
}
