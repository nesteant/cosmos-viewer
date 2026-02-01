import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="app-container">
      <router-outlet />
    </div>
  `,
  styles: [`
    .app-container {
      height: 100vh;
      padding-top: 28px; /* Space for Mac window controls */
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    }
  `],
})
export class AppComponent {
  title = 'Cosmos Viewer';
}
