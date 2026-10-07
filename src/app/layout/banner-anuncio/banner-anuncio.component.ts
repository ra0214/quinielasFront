import { Component } from '@angular/core';
import { IconoComponent } from '../../ui/atoms/icono/icono.component';

/** Molécula: anuncio global. */
@Component({
  selector: 'app-banner-anuncio',
  standalone: true,
  imports: [IconoComponent],
  template: `
    <div class="banner-info">
      <app-icono nombre="megafono" tamano="16px" />
      <strong>Realiza tus aportes con nosotros, pregunte en ventanilla</strong>
    </div>
  `,
  styles: `
    .banner-info {
      background: linear-gradient(90deg, #1d4ed8, #3b82f6);
      color: #fff;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }
  `,
})
export class BannerAnuncioComponent {}
