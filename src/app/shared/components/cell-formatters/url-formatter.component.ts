import { Component, input, computed, inject } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-url-formatter',
  standalone: true,
  imports: [MatTooltipModule],
  template: `
    <a
      class="url-link"
      [href]="value()"
      [matTooltip]="value()"
      target="_blank"
      rel="noopener noreferrer"
      (click)="openExternal($event)"
    >
      {{ displayUrl() }}
    </a>
  `,
  styles: [
    `
      .url-link {
        color: #64b5f6;
        text-decoration: none;
        font-size: 12px;

        &:hover {
          text-decoration: underline;
          color: #90caf9;
        }
      }
    `,
  ],
})
export class UrlFormatterComponent {
  value = input.required<string>();

  displayUrl = computed(() => {
    const url = this.value();
    // Truncate long URLs for display
    if (url.length > 50) {
      return url.substring(0, 47) + '...';
    }
    return url;
  });

  openExternal(event: Event) {
    event.stopPropagation();
    // Let the default behavior handle it (opens in external browser via Electron)
    // The href with target="_blank" will work
  }
}
