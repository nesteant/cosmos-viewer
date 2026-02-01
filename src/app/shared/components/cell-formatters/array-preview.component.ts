import { Component, input, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-array-preview',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="array-container">
      <button class="preview-btn" (click)="toggleExpanded($event)">
        <mat-icon class="expand-icon">{{
          expanded() ? 'expand_less' : 'expand_more'
        }}</mat-icon>
        <span class="preview-text">{{ previewText() }}</span>
      </button>

      @if (expanded()) {
        <div class="expanded-content" (click)="$event.stopPropagation()">
          <pre>{{ formattedJson() }}</pre>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .array-container {
        position: relative;
      }

      .preview-btn {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        background: none;
        border: none;
        color: #80deea;
        cursor: pointer;
        padding: 0;
        font-size: 12px;
        font-family: monospace;

        &:hover {
          color: #b2ebf2;
        }
      }

      .expand-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .preview-text {
        opacity: 0.9;
      }

      .expanded-content {
        position: absolute;
        top: 100%;
        left: 0;
        z-index: 1000;
        background: #1e1e2e;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 8px;
        max-width: 400px;
        max-height: 300px;
        overflow: auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);

        pre {
          margin: 0;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.9);
          white-space: pre-wrap;
          word-break: break-word;
        }
      }
    `,
  ],
})
export class ArrayPreviewComponent {
  value = input.required<any[]>();

  expanded = signal(false);

  previewText = computed(() => {
    const arr = this.value();
    if (arr.length === 0) {
      return '[]';
    }
    return `[${arr.length} item${arr.length > 1 ? 's' : ''}]`;
  });

  formattedJson = computed(() => {
    try {
      return JSON.stringify(this.value(), null, 2);
    } catch {
      return String(this.value());
    }
  });

  toggleExpanded(event: Event) {
    event.stopPropagation();
    this.expanded.update((v) => !v);
  }
}
