import { Component, input, computed } from '@angular/core';
import { detectValueType, DetectedValueType } from '@core/utils';
import { BooleanFormatterComponent } from './boolean-formatter.component';
import { NumberFormatterComponent } from './number-formatter.component';
import { GuidFormatterComponent } from './guid-formatter.component';
import { UrlFormatterComponent } from './url-formatter.component';
import { DateTimeFormatterComponent } from './datetime-formatter.component';
import { ObjectPreviewComponent } from './object-preview.component';
import { ArrayPreviewComponent } from './array-preview.component';

@Component({
  selector: 'app-cell-formatter',
  standalone: true,
  imports: [
    BooleanFormatterComponent,
    NumberFormatterComponent,
    GuidFormatterComponent,
    UrlFormatterComponent,
    DateTimeFormatterComponent,
    ObjectPreviewComponent,
    ArrayPreviewComponent,
  ],
  template: `
    @switch (detectedType()) {
      @case ('boolean') {
        <app-boolean-formatter [value]="value()" />
      }
      @case ('number') {
        <app-number-formatter [value]="value()" />
      }
      @case ('guid') {
        <app-guid-formatter [value]="value()" />
      }
      @case ('url') {
        <app-url-formatter [value]="value()" />
      }
      @case ('datetime') {
        <app-datetime-formatter [value]="value()" />
      }
      @case ('timestamp') {
        <app-datetime-formatter [value]="value()" />
      }
      @case ('object') {
        <app-object-preview [value]="value()" />
      }
      @case ('array') {
        <app-array-preview [value]="value()" />
      }
      @case ('null') {
        <span class="null-value">null</span>
      }
      @case ('undefined') {
        <span class="undefined-value"></span>
      }
      @default {
        <span class="string-value">{{ stringValue() }}</span>
      }
    }
  `,
  styles: [
    `
      :host {
        display: inline;
      }

      .null-value {
        color: rgba(255, 255, 255, 0.4);
        font-style: italic;
        font-size: 12px;
      }

      .undefined-value {
        color: rgba(255, 255, 255, 0.3);
      }

      .string-value {
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
      }
    `,
  ],
})
export class CellFormatterComponent {
  value = input.required<any>();
  fieldPath = input<string>('');

  detectedType = computed((): DetectedValueType => {
    return detectValueType(this.value(), this.fieldPath());
  });

  stringValue = computed(() => {
    const val = this.value();
    if (val === null || val === undefined) {
      return '';
    }
    return String(val);
  });
}
