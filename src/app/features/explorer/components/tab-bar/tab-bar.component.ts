import { Component, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TabState } from '@core/models';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div class="tab-bar">
      @for (tab of tabs(); track tab.id) {
        <div
          class="tab"
          [class.active]="tab.id === activeTabId()"
          (click)="onTabClick(tab)"
          [matTooltip]="tab.databaseId + ' / ' + tab.containerName"
        >
          <mat-icon class="tab-icon">folder</mat-icon>
          <span class="tab-name">{{ tab.containerName }}</span>
          <button
            class="close-btn"
            (click)="onCloseTab(tab, $event)"
            matTooltip="Close tab"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .tab-bar {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        overflow-x: auto;
        min-height: 36px;

        &::-webkit-scrollbar {
          height: 4px;
        }
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color 0.15s ease;
        max-width: 180px;

        &:hover {
          background: rgba(255, 255, 255, 0.1);

          .close-btn {
            opacity: 1;
          }
        }

        &.active {
          background: rgba(103, 58, 183, 0.3);

          .close-btn {
            opacity: 0.7;
          }
        }
      }

      .tab-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #ce93d8;
        flex-shrink: 0;
      }

      .tab-name {
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        color: rgba(255, 255, 255, 0.9);
      }

      .close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        padding: 0;
        margin: 0;
        margin-left: auto;
        border: none;
        border-radius: 3px;
        background: transparent;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s ease, background-color 0.15s ease;
        flex-shrink: 0;

        &:hover {
          background: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.9);
        }

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }
    `,
  ],
})
export class TabBarComponent {
  tabs = input.required<TabState[]>();
  activeTabId = input<string | null>(null);

  tabSelected = output<TabState>();
  tabClosed = output<TabState>();

  onTabClick(tab: TabState) {
    this.tabSelected.emit(tab);
  }

  onCloseTab(tab: TabState, event: Event) {
    event.stopPropagation();
    this.tabClosed.emit(tab);
  }
}
