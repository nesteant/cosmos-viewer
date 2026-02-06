import { Component, NgZone, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    @switch (state()) {
      @case ('available') {
        <div class="update-banner">
          <span>Update available (v{{ version() }})</span>
          <button mat-button color="primary" (click)="download()">Download</button>
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
          <button mat-button color="primary" (click)="install()">Restart Now</button>
          <button mat-icon-button (click)="dismiss()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
    }
  `,
  styles: [`
    .update-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 16px;
      background: #1a3a5c;
      color: #e0e0e0;
      font-size: 13px;
      -webkit-app-region: no-drag;
    }

    mat-progress-bar {
      flex: 1;
    }

    span {
      white-space: nowrap;
    }
  `],
})
export class UpdateBannerComponent implements OnInit {
  state = signal<UpdateState>('idle');
  version = signal('');
  percent = signal(0);

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
        this.state.set('idle');
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

  dismiss(): void {
    this.state.set('idle');
  }
}
