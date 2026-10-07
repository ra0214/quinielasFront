import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconoComponent, IconoNombre } from '../../atoms/icono/icono.component';

export interface OpcionChip {
  etiqueta: string;
  valor: string;
  /** Icono opcional delante de la etiqueta. */
  icono?: IconoNombre;
  /** Variante de color cuando el chip está activo. */
  claseActivo?: 'activo-rojo' | 'activo-verde';
}

/** Molécula: grupo de filtros tipo "chips". */
@Component({
  selector: 'app-chips-filtro',
  standalone: true,
  imports: [IconoComponent],
  template: `
    <div class="chips">
      @for (c of opciones; track c.valor) {
        <button type="button" [class]="claseDe(c)" (click)="cambio.emit(c.valor)">
          @if (c.icono) {
            <app-icono [nombre]="c.icono" tamano="13px" />
          }
          {{ c.etiqueta }}
        </button>
      }
    </div>
  `,
  styles: `
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .chips button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 7px 14px;
      border: 1px solid #e2e8f0;
      background: #fff;
      border-radius: 999px;
      font-size: 13px;
      cursor: pointer;
      color: #475569;
      transition: all 0.15s;
      font-family: inherit;
    }
    .chips button:hover {
      border-color: #2563eb;
      color: #2563eb;
    }
    .chips button.activo {
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
      font-weight: 600;
    }
    .chips button.activo.activo-rojo {
      background: #dc2626;
      border-color: #dc2626;
    }
    .chips button.activo.activo-verde {
      background: #16a34a;
      border-color: #16a34a;
    }
  `,
})
export class ChipsFiltroComponent {
  @Input() opciones: OpcionChip[] = [];
  @Input() activo = '';
  @Output() cambio = new EventEmitter<string>();

  claseDe(c: OpcionChip): string {
    let clase = 'chip';
    if (c.valor === this.activo) {
      clase += ' activo';
      if (c.claseActivo) clase += ' ' + c.claseActivo;
    }
    return clase;
  }
}
