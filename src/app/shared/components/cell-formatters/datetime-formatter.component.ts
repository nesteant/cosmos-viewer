import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { parseDate, formatRelativeTime, formatFullDateTime } from '@core/utils';

@Component({
  selector: 'app-datetime-formatter',
  standalone: true,
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="datetime-value" [matTooltip]="tooltip()" matTooltipPosition="above">
      {{ display() }}
    </span>
  `,
  styles: [
    `
      .datetime-value {
        color: #ffcc80;
        cursor: help;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class DateTimeFormatterComponent {
  value = input.required<string | number>();

  parsedDate = computed(() => parseDate(this.value()));

  /**
   * The cell renders the actual date (compact, locale-independent ISO-like
   * form so it's unambiguous and sortable). The "X ago" comparison moved to
   * the tooltip — having it as the primary label was misleading because
   * relative time is approximate ("2 days ago" can hide a 24-hour skew).
   */
  display = computed(() => {
    const date = this.parsedDate();
    if (!date) return String(this.value());
    return formatCompactLocal(date);
  });

  tooltip = computed(() => {
    const date = this.parsedDate();
    if (!date) return String(this.value());
    return `${formatFullDateTime(date)}\n${formatRelativeTime(date)}`;
  });
}

/**
 * `YYYY-MM-DD HH:mm:ss` in the local timezone — compact enough for a cell,
 * unambiguous enough that no human will misread it.
 */
function formatCompactLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
