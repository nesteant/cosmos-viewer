import { Component, input, computed } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { inject } from '@angular/core';

@Component({
  selector: 'app-guid-formatter',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <span class="guid-container">
      <span class="guid-value">
        @for (segment of segments(); track $index; let last = $last) {
          <span class="guid-segment">{{ segment }}</span>@if (!last) {<span class="guid-dash">-</span>}
        }
      </span>
      <button
        mat-icon-button
        class="copy-btn"
        matTooltip="Copy GUID"
        (click)="copyToClipboard($event)"
      >
        <mat-icon>content_copy</mat-icon>
      </button>
    </span>
  `,
  styles: [
    `
      .guid-container {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .guid-value {
        font-family: monospace;
        font-size: 11px;
        letter-spacing: 0.3px;
      }

      .guid-segment {
        color: #90caf9;
      }

      .guid-dash {
        color: rgba(255, 255, 255, 0.3);
      }

      .copy-btn {
        width: 20px;
        height: 20px;
        line-height: 20px;
        opacity: 0;
        transition: opacity 0.15s ease;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }

      :host:hover .copy-btn {
        opacity: 0.7;
      }

      .copy-btn:hover {
        opacity: 1 !important;
      }
    `,
  ],
})
export class GuidFormatterComponent {
  private clipboard = inject(Clipboard);

  value = input.required<string>();

  segments = computed(() => this.value().split('-'));

  copyToClipboard(event: Event) {
    event.stopPropagation();
    this.clipboard.copy(this.value());
  }
}
