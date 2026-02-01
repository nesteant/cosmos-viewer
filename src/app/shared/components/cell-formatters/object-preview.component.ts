import { Component, input, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-object-preview',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="object-container">
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
      .object-container {
        position: relative;
      }

      .preview-btn {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        background: none;
        border: none;
        color: #a5d6a7;
        cursor: pointer;
        padding: 0;
        font-size: 12px;
        font-family: monospace;

        &:hover {
          color: #c8e6c9;
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
export class ObjectPreviewComponent {
  value = input.required<object>();

  expanded = signal(false);

  previewText = computed(() => {
    const obj = this.value();
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '{}';
    }
    return `{${keys.length} field${keys.length > 1 ? 's' : ''}...}`;
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
