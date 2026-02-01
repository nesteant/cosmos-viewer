import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-number-formatter',
  standalone: true,
  template: `
    <span class="number-value">{{ formattedNumber() }}</span>
  `,
  styles: [
    `
      .number-value {
        font-family: monospace;
        color: #ce93d8;
      }
    `,
  ],
})
export class NumberFormatterComponent {
  value = input.required<number>();

  formattedNumber = computed(() => {
    const num = this.value();
    // Use Intl.NumberFormat for thousands separators
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 6,
    }).format(num);
  });
}
