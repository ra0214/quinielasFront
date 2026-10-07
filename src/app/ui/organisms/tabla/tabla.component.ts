import { CommonModule } from '@angular/common';
import {
  Component,
  ContentChildren,
  Input,
  OnInit,
  QueryList,
  TemplateRef,
} from '@angular/core';
import {
  formatoFecha,
  formatoFechaCorta,
  formatoMoneda,
  formatoPorcentaje,
  ordenar,
} from '../../../core/domain/helpers';
import { CeldaDirective, ContextoCelda } from './celda.directive';
import { IconoComponent, IconoNombre } from '../../atoms/icono/icono.component';

export interface ColumnaTabla {
  clave: string;
  etiqueta: string;
  /** Cómo se formatea el valor; por defecto se muestra tal cual. */
  tipo?: 'texto' | 'numero' | 'moneda' | 'porcentaje' | 'fecha' | 'fecha-corta';
  /** 'num' alinea a la derecha; 'acciones' alinea y respeta botones. */
  clase?: string;
  /** Por defecto todas las columnas son ordenables. */
  ordenable?: boolean;
}

/**
 * Organismo: tabla genérica con ordenamiento por columna, estados de
 * carga/vacío y celdas personalizadas mediante `ng-template[celda]`.
 */
@Component({
  selector: 'app-tabla',
  standalone: true,
  imports: [CommonModule, IconoComponent],
  templateUrl: './tabla.component.html',
  styleUrl: './tabla.component.css',
})
export class TablaComponent implements OnInit {
  @Input() columnas: ColumnaTabla[] = [];
  @Input() filas: unknown[] = [];
  @Input() cargando = false;
  @Input() mensajeVacio = 'No hay registros';
  @Input() iconoVacio: IconoNombre = 'documento';
  /** Campo usado como key del @for (ej. 'id_cliente'). Si falta, se usa el índice. */
  @Input() trackClave = '';
  /** Orden inicial (la tabla administra el orden a partir de ahí). */
  @Input() columnaOrden = '';
  @Input() ascendente = true;

  @ContentChildren(CeldaDirective) celdas?: QueryList<CeldaDirective>;

  private col = '';
  private asc = true;

  ngOnInit(): void {
    this.col = this.columnaOrden;
    this.asc = this.ascendente;
  }

  get filasOrdenadas(): unknown[] {
    if (!this.col) return this.filas;
    return ordenar(this.filas, this.col, this.asc);
  }

  esOrdenable(c: ColumnaTabla): boolean {
    return c.ordenable !== false;
  }

  alternarOrden(c: ColumnaTabla): void {
    if (!this.esOrdenable(c)) return;
    if (this.col === c.clave) {
      this.asc = !this.asc;
    } else {
      this.col = c.clave;
      this.asc = true;
    }
  }

  flecha(c: ColumnaTabla): string {
    if (this.col !== c.clave) return '';
    return this.asc ? '▲' : '▼';
  }

  texto(c: ColumnaTabla, fila: unknown): string {
    const obj = fila as Record<string, unknown>;
    const v = obj[c.clave];
    if (v === null || v === undefined || v === '') return '—';
    switch (c.tipo) {
      case 'moneda':
        return formatoMoneda(Number(v));
      case 'porcentaje':
        return formatoPorcentaje(Number(v));
      case 'fecha':
        return formatoFecha(String(v));
      case 'fecha-corta':
        return formatoFechaCorta(String(v));
      case 'numero':
        return Number(v).toLocaleString('es-MX');
      default:
        return String(v);
    }
  }

  plantillaDe(clave: string): TemplateRef<ContextoCelda> | null {
    const dir = this.celdas?.find((d) => d.celda === clave);
    return dir?.templateRef ?? null;
  }

  claveFila(fila: unknown, indice: number): unknown {
    if (!this.trackClave) return indice;
    return (fila as Record<string, unknown>)?.[this.trackClave] ?? indice;
  }
}
