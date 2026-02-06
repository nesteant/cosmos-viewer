import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

interface KeyboardShortcut {
  keys: string;
  action: string;
}

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Settings</h2>
    <mat-dialog-content>
      <mat-tab-group>
        <!-- General tab -->
        <mat-tab label="General">
          <div class="tab-content">
            <div class="settings-section">
              <h3>Updates</h3>
              <div class="setting-row">
                <mat-slide-toggle
                  [checked]="settings().allowPrerelease"
                  (change)="onToggle('allowPrerelease', $event.checked)"
                >
                  Allow pre-release updates
                </mat-slide-toggle>
              </div>
              <div class="setting-row">
                <mat-slide-toggle
                  [checked]="settings().autoCheckUpdates"
                  (change)="onToggle('autoCheckUpdates', $event.checked)"
                >
                  Check for updates on startup
                </mat-slide-toggle>
              </div>
              <div class="setting-row">
                <button mat-stroked-button (click)="checkForUpdates()">
                  Check for Updates Now
                </button>
              </div>
            </div>

            <div class="settings-section">
              <h3>Data</h3>
              <div class="setting-row">
                <button mat-stroked-button color="warn" (click)="clearAllData()">
                  Clear All Data
                </button>
                <span class="setting-hint">Removes all connections and preferences</span>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Appearance tab -->
        <mat-tab label="Appearance">
          <div class="tab-content">
            <div class="settings-section">
              <h3>Font</h3>
              <div class="setting-row">
                <mat-form-field appearance="outline">
                  <mat-label>UI Font Size</mat-label>
                  <mat-select
                    [value]="settings().fontSize"
                    (selectionChange)="onFontSizeChange('fontSize', $event.value)"
                  >
                    @for (size of fontSizes; track size) {
                      <mat-option [value]="size">{{ size }}px</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="setting-row">
                <mat-form-field appearance="outline">
                  <mat-label>Editor Font Size</mat-label>
                  <mat-select
                    [value]="settings().editorFontSize"
                    (selectionChange)="onFontSizeChange('editorFontSize', $event.value)"
                  >
                    @for (size of editorFontSizes; track size) {
                      <mat-option [value]="size">{{ size }}px</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Keyboard Shortcuts tab -->
        <mat-tab label="Keyboard Shortcuts">
          <div class="tab-content">
            <table class="shortcuts-table">
              <thead>
                <tr>
                  <th>Shortcut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (shortcut of shortcuts; track shortcut.action) {
                  <tr>
                    <td><kbd>{{ shortcut.keys }}</kbd></td>
                    <td>{{ shortcut.action }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="close()">Done</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }

    mat-dialog-content {
      width: 480px;
      height: 460px;
      padding: 0 24px;
      overflow: hidden;
    }

    .tab-content {
      padding: 20px 4px;
    }

    .settings-section {
      margin-bottom: 24px;

      h3 {
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0 0 12px 0;
      }
    }

    .setting-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;

      mat-form-field {
        width: 200px;
      }
    }

    .setting-hint {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }

    .shortcuts-table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        text-align: left;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      th {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.5);
      }

      td {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.87);
      }

      kbd {
        display: inline-block;
        padding: 2px 8px;
        font-size: 12px;
        font-family: 'JetBrains Mono', monospace;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.87);
      }
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }
  `],
})
export class SettingsDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<SettingsDialogComponent>);
  private settingsService = inject(AppSettingsService);
  private dialog = inject(MatDialog);

  settings = this.settingsService.settings;

  fontSizes = [12, 13, 14, 15, 16, 17, 18];
  editorFontSizes = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

  private isMac = navigator.platform.toUpperCase().includes('MAC');
  private mod = this.isMac ? 'Cmd' : 'Ctrl';

  shortcuts: KeyboardShortcut[] = [
    { keys: `${this.mod}+Enter`, action: 'Execute query' },
    { keys: `${this.mod}+Shift+A`, action: 'Analyze query' },
    { keys: `${this.mod}+C`, action: 'Copy selection' },
    { keys: `${this.mod}+V`, action: 'Paste to selection' },
    { keys: 'Delete / Backspace', action: 'Delete cell value' },
    { keys: 'Arrow keys', action: 'Navigate table cells' },
    { keys: 'Shift+Arrow', action: 'Extend cell selection' },
    { keys: 'Enter', action: 'Start editing cell' },
    { keys: 'Escape', action: 'Cancel / Close' },
    { keys: 'Tab', action: 'Next cell' },
    { keys: `${this.mod}+,`, action: 'Open Settings' },
  ];

  ngOnInit(): void {
    this.settingsService.loadSettings();
  }

  onToggle(key: 'allowPrerelease' | 'autoCheckUpdates', value: boolean): void {
    this.settingsService.updateSettings({ [key]: value });
  }

  onFontSizeChange(key: 'fontSize' | 'editorFontSize', value: number): void {
    this.settingsService.updateSettings({ [key]: value });
  }

  checkForUpdates(): void {
    window.electronAPI?.updater.checkForUpdates();
  }

  clearAllData(): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Clear All Data',
          message:
            'This will remove all saved connections, preferences, and settings. The app will restart. Are you sure?',
          confirmText: 'Clear All',
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          window.location.reload();
        }
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}
