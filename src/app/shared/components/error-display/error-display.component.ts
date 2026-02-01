import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-error-display',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="error-container">
      <mat-icon class="error-icon">error_outline</mat-icon>
      <h3 class="error-title">{{ title() }}</h3>
      <p class="error-message">{{ message() }}</p>
      @if (showRetry()) {
        <button mat-stroked-button color="primary" (click)="retry.emit()">
          <mat-icon>refresh</mat-icon>
          Retry
        </button>
      }
    </div>
  `,
  styles: [
    `
      .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        gap: 12px;
      }

      .error-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #f44336;
      }

      .error-title {
        margin: 0;
        color: rgba(255, 255, 255, 0.87);
        font-size: 20px;
        font-weight: 500;
      }

      .error-message {
        margin: 0;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        max-width: 400px;
      }

      button {
        margin-top: 16px;
      }

      button mat-icon {
        margin-right: 8px;
      }
    `,
  ],
})
export class ErrorDisplayComponent {
  title = input('Something went wrong');
  message = input('An unexpected error occurred. Please try again.');
  showRetry = input(true);
  retry = output<void>();
}
