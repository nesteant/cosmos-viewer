import { Component, input, computed } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { parseDate, formatRelativeTime, formatFullDateTime } from '@core/utils';

@Component({
  selector: 'app-datetime-formatter',
  standalone: true,
  imports: [MatTooltipModule],
  template: `
    <span class="datetime-value" [matTooltip]="fullDateTime()">
      {{ relativeTime() }}
    </span>
  `,
  styles: [
    `
      .datetime-value {
        color: #ffcc80;
        cursor: help;
        font-size: 12px;
      }
    `,
  ],
})
export class DateTimeFormatterComponent {
  value = input.required<string | number>();

  parsedDate = computed(() => parseDate(this.value()));

  relativeTime = computed(() => {
    const date = this.parsedDate();
    if (!date) {
      return String(this.value());
    }
    return formatRelativeTime(date);
  });

  fullDateTime = computed(() => {
    const date = this.parsedDate();
    if (!date) {
      return String(this.value());
    }
    return formatFullDateTime(date);
  });
}
