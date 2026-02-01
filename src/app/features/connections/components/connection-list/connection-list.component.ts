import { Component, input, output } from '@angular/core';
import { CosmosConnection } from '@core/models';
import { ConnectionCardComponent } from '../connection-card/connection-card.component';

@Component({
  selector: 'app-connection-list',
  standalone: true,
  imports: [ConnectionCardComponent],
  template: `
    @if (connections().length === 0) {
      <div class="empty-state">
        <p>No connections yet. Add your first connection to get started.</p>
      </div>
    } @else {
      <div class="connection-grid">
        @for (connection of connections(); track connection.id) {
          <app-connection-card
            [connection]="connection"
            (connect)="connect.emit($event)"
            (edit)="edit.emit($event)"
            (duplicate)="duplicate.emit($event)"
            (delete)="delete.emit($event)"
          />
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
    `,
  ],
})
export class ConnectionListComponent {
  connections = input.required<CosmosConnection[]>();

  connect = output<CosmosConnection>();
  edit = output<CosmosConnection>();
  duplicate = output<CosmosConnection>();
  delete = output<CosmosConnection>();
}
