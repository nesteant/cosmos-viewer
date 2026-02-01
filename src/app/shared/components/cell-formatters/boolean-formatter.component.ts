import { Component, input } from '@angular/core';

@Component({
  selector: 'app-boolean-formatter',
  standalone: true,
  template: `
    <span class="boolean-badge" [class.true]="value()" [class.false]="!value()">
      {{ value() ? 'true' : 'false' }}
    </span>
  `,
  styles: [
    `
      .boolean-badge {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        font-family: monospace;
      }

      .boolean-badge.true {
        background: rgba(76, 175, 80, 0.2);
        color: #81c784;
      }

      .boolean-badge.false {
        background: rgba(244, 67, 54, 0.2);
        color: #e57373;
      }
    `,
  ],
})
export class BooleanFormatterComponent {
  value = input.required<boolean>();
}
