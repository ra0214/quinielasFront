import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { BannerAnuncioComponent } from './layout/banner-anuncio/banner-anuncio.component';
import { ToastContainerComponent } from './ui/molecules/toast-container/toast-container.component';
import { IconoComponent } from './ui/atoms/icono/icono.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    BannerAnuncioComponent,
    ToastContainerComponent,
    IconoComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  menuAbierto = false;
}
