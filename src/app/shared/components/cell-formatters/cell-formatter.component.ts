import { Component, input, computed } from '@angular/core';
import { detectValueType, DetectedValueType, extractMongoDisplayValue } from '@core/utils';
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
      @case ('numberLong') {
        <span class="number-value">{{ mongoDisplayValue() }}</span>
      }
      @case ('numberDecimal') {
        <span class="number-value">{{ mongoDisplayValue() }}</span>
      }
      @case ('guid') {
        <app-guid-formatter [value]="guidValue()" />
      }
      @case ('binaryUuid') {
        <app-guid-formatter [value]="mongoDisplayValue()" />
      }
      @case ('objectId') {
        <span class="objectid-value" [title]="mongoDisplayValue()">{{ mongoDisplayValue() }}</span>
      }
      @case ('url') {
        <app-url-formatter [value]="value()" />
      }
      @case ('datetime') {
        <app-datetime-formatter [value]="value()" />
      }
      @case ('mongoDate') {
        <span class="datetime-value">{{ mongoDisplayValue() }}</span>
      }
      @case ('timestamp') {
        <app-datetime-formatter [value]="value()" />
      }
      @case ('regex') {
        <span class="regex-value">{{ mongoDisplayValue() }}</span>
      }
      @case ('binary') {
        <span class="binary-value" [title]="'Binary data'">{{ mongoDisplayValue() }}</span>
      }
      @case ('object') {
        <app-object-preview [value]="value()" />
      }
      @case ('array') {
        <app-array-preview [value]="value()" />
      }
      @case ('null') {
        <span class="subtle-value">null</span>
      }
      @case ('undefined') {
        <span class="subtle-value">empty</span>
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

      .subtle-value {
        font-size: 11px;
        font-style: italic;
        color: rgba(255, 255, 255, 0.35);
      }

      .string-value {
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
      }

      .objectid-value {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        font-size: 11px;
        color: #ce93d8;
      }

      .number-value {
        color: #90caf9;
        font-size: 12px;
      }

      .datetime-value {
        color: #a5d6a7;
        font-size: 12px;
      }

      .regex-value {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        font-size: 11px;
        color: #ffcc80;
      }

      .binary-value {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        font-size: 11px;
        color: #bcaaa4;
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

  /** Extract display value from MongoDB Extended JSON */
  mongoDisplayValue = computed(() => {
    return extractMongoDisplayValue(this.value());
  });

  /** Get GUID value (handles both string and $uuid format) */
  guidValue = computed(() => {
    const val = this.value();
    if (typeof val === 'string') return val;
    if (val?.$uuid) return val.$uuid;
    return extractMongoDisplayValue(val);
  });
}
