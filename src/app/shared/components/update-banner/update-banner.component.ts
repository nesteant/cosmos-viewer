import { Component, NgZone, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    @switch (state()) {
      @case ('available') {
        <div class="update-banner">
          <span>Update available (v{{ version() }})</span>
          <button mat-button class="banner-btn" (click)="download()">Download</button>
          <button mat-icon-button (click)="dismiss()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
      @case ('downloading') {
        <div class="update-banner">
          <span>Downloading update... {{ percent() | number:'1.0-0' }}%</span>
          <mat-progress-bar mode="determinate" [value]="percent()" />
        </div>
      }
      @case ('downloaded') {
        <div class="update-banner">
          <span>Update ready — will install on next restart</span>
          <button mat-button class="banner-btn" (click)="install()">Restart Now</button>
          <button mat-icon-button (click)="dismiss()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
      @case ('error') {
        <div class="update-banner error">
          <span>Update failed: {{ errorMessage() }}</span>
          <button mat-button class="banner-btn" (click)="retry()">Retry</button>
          <button mat-icon-button (click)="dismiss()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
    }
  `,
  styles: [`
    :host {
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 9999;
    }

    .update-banner.error {
      background: #5c1a1a;
    }

    .update-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #1a3a5c;
      color: #e0e0e0;
      font-size: 13px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      -webkit-app-region: no-drag;
    }

    mat-progress-bar {
      width: 120px;
    }

    span {
      white-space: nowrap;
    }

    .banner-btn {
      color: #90caf9;
      font-weight: 500;
    }
  `],
})
export class UpdateBannerComponent implements OnInit {
  state = signal<UpdateState>('idle');
  version = signal('');
  percent = signal(0);
  errorMessage = signal('');

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    const api = window.electronAPI?.updater;
    if (!api) return;

    api.onUpdateAvailable((info) => {
      this.ngZone.run(() => {
        this.version.set(info.version);
        this.state.set('available');
      });
    });

    api.onDownloadProgress((progress) => {
      this.ngZone.run(() => {
        this.percent.set(progress.percent);
      });
    });

    api.onUpdateDownloaded(() => {
      this.ngZone.run(() => {
        this.state.set('downloaded');
      });
    });

    api.onError((error) => {
      console.error('Update error:', error);
      this.ngZone.run(() => {
        this.errorMessage.set(error);
        this.state.set('error');
      });
    });
  }

  download(): void {
    this.state.set('downloading');
    this.percent.set(0);
    window.electronAPI.updater.downloadUpdate();
  }

  install(): void {
    window.electronAPI.updater.installUpdate();
  }

  retry(): void {
    this.state.set('downloading');
    this.percent.set(0);
    window.electronAPI.updater.downloadUpdate();
  }

  dismiss(): void {
    this.state.set('idle');
  }
}
