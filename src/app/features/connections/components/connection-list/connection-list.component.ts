import { Component, input, output } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { DatabaseConnection } from '@core/models';
import { ConnectionCardComponent } from '../connection-card/connection-card.component';

@Component({
  selector: 'app-connection-list',
  standalone: true,
  imports: [ConnectionCardComponent, DragDropModule],
  template: `
    @if (connections().length === 0) {
      <div class="empty-state">
        <p>No connections yet. Add your first connection to get started.</p>
      </div>
    } @else {
      <div class="connection-grid" cdkDropList cdkDropListOrientation="mixed" (cdkDropListDropped)="onDrop($event)">
        @for (connection of connections(); track connection.id) {
          <app-connection-card
            cdkDrag
            [connection]="connection"
            (connect)="connect.emit($event)"
            (edit)="edit.emit($event)"
            (duplicate)="duplicate.emit($event)"
            (delete)="delete.emit($event)"
          >
            <div class="drag-placeholder" *cdkDragPlaceholder></div>
          </app-connection-card>
        }
      </div>
    }
  `,
  styles: [
    `
      .connection-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 20px;
      }

      .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 16px;
      }

      .drag-placeholder {
        background: rgba(187, 134, 252, 0.1);
        border: 2px dashed rgba(187, 134, 252, 0.4);
        border-radius: 12px;
        min-height: 180px;
      }

      :host ::ng-deep .cdk-drag-preview {
        box-sizing: border-box;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }

      :host ::ng-deep .cdk-drag-animating {
        transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
      }

      :host ::ng-deep .connection-grid.cdk-drop-list-dragging app-connection-card:not(.cdk-drag-placeholder) {
        transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
      }
    `,
  ],
})
export class ConnectionListComponent {
  connections = input.required<DatabaseConnection[]>();

  connect = output<DatabaseConnection>();
  edit = output<DatabaseConnection>();
  duplicate = output<DatabaseConnection>();
  delete = output<DatabaseConnection>();
  reorder = output<DatabaseConnection[]>();

  onDrop(event: CdkDragDrop<DatabaseConnection[]>) {
    if (event.previousIndex !== event.currentIndex) {
      const reordered = [...this.connections()];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      this.reorder.emit(reordered);
    }
  }
}
