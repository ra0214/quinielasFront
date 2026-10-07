import { Component, Input } from '@angular/core';

/** Organismo: encabezado de página (título + descripción + zona de acciones). */
@Component({
  selector: 'app-encabezado-pagina',
  standalone: true,
  template: `
    <div class="pagina-titulo">
      <div>
        <h1>{{ titulo }}</h1>
        @if (descripcion) {
          <p>{{ descripcion }}</p>
        }
      </div>
      <div class="acciones"><ng-content /></div>
    </div>
  `,
  styles: `
    .pagina-titulo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .pagina-titulo h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
    }
    .pagina-titulo p {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 13px;
    }
  `,
})
export class EncabezadoPaginaComponent {
  @Input({ required: true }) titulo = '';
  @Input() descripcion = '';
}
