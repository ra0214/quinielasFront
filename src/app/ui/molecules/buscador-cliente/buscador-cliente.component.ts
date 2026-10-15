import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cliente } from '../../../core/domain/models';
import { IconoComponent } from '../../atoms/icono/icono.component';

/**
 * Molécula: selector de cliente con autocompletado. Al escribir se despliegan
 * sugerencias con los nombres que coinciden; al elegir una se marca el cliente.
 *
 * - `[(idSeleccionado)]` mantiene el id del cliente elegido (filtros).
 * - `(textoChange)` emite el texto escrito (búsquedas libres, p. ej. Clientes).
 * - `(idSeleccionadoChange)` emite `null` al limpiar.
 */
@Component({
  selector: 'app-buscador-cliente',
  standalone: true,
  imports: [FormsModule, IconoComponent],
  template: `
    <div class="bc" [class.abierto]="abierto">
      <div class="bc-campo">
        <span class="lupa"><app-icono nombre="buscar" tamano="14px" /></span>
        <input
          type="text"
          [placeholder]="placeholder"
          [disabled]="deshabilitado"
          [(ngModel)]="texto"
          (focus)="abrir()"
          (input)="alEscribir()"
          (blur)="alSalir()" />
        @if (texto) {
          <button
            type="button"
            class="limpiar"
            title="Quitar selección"
            aria-label="Quitar selección"
            (mousedown)="limpiar($event)">
            <app-icono nombre="cerrar" tamano="12px" />
          </button>
        }
      </div>
      @if (abierto && filtrados.length > 0) {
        <ul class="bc-lista" role="listbox">
          @for (c of filtrados; track c.id_cliente) {
            <li role="option" (mousedown)="elegir(c, $event)">
              <span class="bc-nombre">{{ c.nombre }}</span>
              <span class="bc-telefono">{{ c.telefono }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      flex: 1;
      min-width: 220px;
    }
    .bc {
      position: relative;
    }
    .bc-campo {
      position: relative;
    }
    input {
      width: 100%;
      padding: 9px 30px 9px 34px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
      background: #fff;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
    }
    input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    input:disabled {
      background: #f1f5f9;
      color: #64748b;
    }
    .lupa {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #64748b;
      pointer-events: none;
    }
    .limpiar {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      padding: 2px;
      border-radius: 4px;
    }
    .limpiar:hover {
      color: #475569;
      background: #f1f5f9;
    }
    .bc-lista {
      position: absolute;
      z-index: 40;
      left: 0;
      right: 0;
      top: calc(100% + 4px);
      margin: 0;
      padding: 4px;
      list-style: none;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
      max-height: 240px;
      overflow-y: auto;
    }
    .bc-lista li {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 7px;
      cursor: pointer;
      font-size: 14px;
      color: #1e293b;
    }
    .bc-lista li:hover {
      background: #eff6ff;
      color: #1d4ed8;
    }
    .bc-telefono {
      color: #94a3b8;
      font-size: 12px;
    }
  `,
})
export class BuscadorClienteComponent implements OnChanges {
  @Input() clientes: Cliente[] = [];
  @Input() idSeleccionado: number | null = null;
  @Input() placeholder = 'Buscar cliente…';
  @Input() deshabilitado = false;
  @Output() idSeleccionadoChange = new EventEmitter<number | null>();
  @Output() textoChange = new EventEmitter<string>();

  texto = '';
  abierto = false;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['idSeleccionado'] || changes['clientes']) && this.idSeleccionado) {
      const c = this.clientes.find((x) => x.id_cliente === this.idSeleccionado);
      if (c && c.nombre !== this.texto) this.texto = c.nombre;
    }
  }

  get filtrados(): Cliente[] {
    const t = this.texto.trim().toLowerCase();
    if (!t) return this.clientes.slice(0, 8);
    return this.clientes.filter((c) => c.nombre.toLowerCase().includes(t)).slice(0, 8);
  }

  abrir(): void {
    if (this.deshabilitado) return;
    this.abierto = true;
  }

  alEscribir(): void {
    this.abierto = true;
    this.textoChange.emit(this.texto);
    // El texto dejó de coincidir con el cliente elegido: se deselecciona.
    const c = this.clientes.find((x) => x.id_cliente === this.idSeleccionado);
    if (this.idSeleccionado && (!c || c.nombre !== this.texto)) {
      this.idSeleccionado = null;
      this.idSeleccionadoChange.emit(null);
    }
  }

  alSalir(): void {
    setTimeout(() => (this.abierto = false), 120);
  }

  elegir(c: Cliente, ev: Event): void {
    ev.preventDefault();
    this.texto = c.nombre;
    this.idSeleccionado = c.id_cliente;
    this.idSeleccionadoChange.emit(c.id_cliente);
    this.textoChange.emit(c.nombre);
    this.abierto = false;
  }

  limpiar(ev: Event): void {
    ev.preventDefault();
    this.texto = '';
    this.idSeleccionado = null;
    this.idSeleccionadoChange.emit(null);
    this.textoChange.emit('');
    this.abierto = true;
  }
}
