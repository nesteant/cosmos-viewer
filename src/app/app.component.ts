import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="titlebar"></div>
    <div class="app-container">
      <router-outlet />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .titlebar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 28px;
      -webkit-app-region: drag;
      z-index: 9999;
    }

    .app-container {
      position: absolute;
      top: 28px;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `],
})
export class AppComponent {
  title = 'Cosmos Viewer';
}
