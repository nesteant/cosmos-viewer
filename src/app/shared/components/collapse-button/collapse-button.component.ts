import { Component, input, output, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-collapse-button',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <button
      class="collapse-btn"
      [matTooltip]="tooltip()"
      (click)="toggle.emit(); $event.stopPropagation()"
    >
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .collapse-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        margin: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        &:active {
          background: rgba(255, 255, 255, 0.15);
        }

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    `,
  ],
})
export class CollapseButtonComponent {
  collapsed = input(false);
  direction = input<'horizontal' | 'vertical'>('horizontal');
  label = input<string>('');

  toggle = output<void>();

  icon = computed(() => {
    const dir = this.direction();
    const isCollapsed = this.collapsed();

    if (dir === 'horizontal') {
      return isCollapsed ? 'chevron_right' : 'chevron_left';
    } else {
      return isCollapsed ? 'expand_more' : 'expand_less';
    }
  });

  tooltip = computed(() => {
    const lbl = this.label();
    const isCollapsed = this.collapsed();
    const action = isCollapsed ? 'Expand' : 'Collapse';
    return lbl ? `${action} ${lbl}` : action;
  });
}
