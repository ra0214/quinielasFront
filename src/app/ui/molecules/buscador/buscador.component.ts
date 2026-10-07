import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { IconoComponent } from '../../atoms/icono/icono.component';

/**
 * Molécula: campo de búsqueda con debounce (300 ms).
 * - `[(texto)]` mantiene el valor en el padre.
 * - `(buscado)` emite solo cuando el usuario deja de escribir.
 */
@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [FormsModule, IconoComponent],
  template: `
    <div class="buscador">
      <span class="lupa"><app-icono nombre="buscar" tamano="14px" /></span>
      <input
        type="text"
        [placeholder]="placeholder"
        [(ngModel)]="texto"
        (input)="onInput()" />
    </div>
  `,
  styles: `
    .buscador {
      position: relative;
      flex: 1;
      min-width: 220px;
      max-width: 380px;
    }
    .buscador input {
      width: 100%;
      padding: 9px 12px 9px 34px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
      background: #fff;
      outline: none;
      box-sizing: border-box;
    }
    .buscador input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    @media (max-width: 720px) {
      .buscador {
        max-width: none;
        min-width: 100%;
      }
    }
    .buscador .lupa {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #64748b;
      pointer-events: none;
    }
  `,
})
export class BuscadorComponent implements OnDestroy {
  @Input() texto = '';
  @Input() placeholder = 'Buscar…';
  @Output() textoChange = new EventEmitter<string>();
  @Output() buscado = new EventEmitter<string>();

  private readonly debounce = new Subject<string>();
  private readonly sub: Subscription;

  constructor() {
    this.sub = this.debounce.subscribe((v) => this.buscado.emit(v));
  }

  onInput(): void {
    this.textoChange.emit(this.texto);
    this.debounce.next(this.texto);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
