import { Component, effect, inject, NgZone, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { UpdateBannerComponent, SettingsDialogComponent } from './shared';
import { AppSettingsService, ElectronService } from './core/services';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UpdateBannerComponent],
  template: `
    <div class="titlebar"></div>
    <app-update-banner />
    <div class="app-container">
      <router-outlet />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .titlebar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 28px;
      -webkit-app-region: drag;
      z-index: 9999;
    }

    .app-container {
      position: absolute;
      top: 28px;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `],
})
export class AppComponent implements OnInit {
  title = 'Cosmos Viewer';

  private dialog = inject(MatDialog);
  private ngZone = inject(NgZone);
  private settingsService = inject(AppSettingsService);
  private electronService = inject(ElectronService);

  constructor() {
    // Reactively apply font settings whenever the signal changes
    effect(() => {
      const s = this.settingsService.settings();
      document.documentElement.style.setProperty('--app-font-size', `${s.fontSize}px`);
      document.documentElement.style.setProperty('--editor-font-size', `${s.editorFontSize}px`);
    });
  }

  ngOnInit(): void {
    // Load persisted settings on startup
    this.settingsService.loadSettings();

    // Listen for settings:open from menu
    this.electronService.onSettingsOpen(() => {
      this.ngZone.run(() => this.openSettings());
    });
  }

  private openSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '600px',
      maxHeight: '80vh',
    });
  }
}
