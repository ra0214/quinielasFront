import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconoComponent } from '../../atoms/icono/icono.component';

/**
 * Molécula: modal con encabezado, cuerpo y pie.
 * Uso:
 *   <app-modal [visible]="abierto" titulo="Nuevo registro" (cerrar)="abierto = false">
 *     ...contenido...
 *     <div pie>...botones...</div>
 *   </app-modal>
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconoComponent],
  template: `
    @if (visible) {
      <div class="overlay" (click)="cerrar.emit()">
        <div [class]="'modal' + (grande ? ' modal-grande' : '')" (click)="$event.stopPropagation()">
          <div class="modal-cabecera">
            <h3>{{ titulo }}</h3>
            <button type="button" class="cerrar" (click)="cerrar.emit()" aria-label="Cerrar">
              <app-icono nombre="cerrar" tamano="18px" />
            </button>
          </div>
          <div class="modal-cuerpo">
            <ng-content></ng-content>
          </div>
          <div class="modal-pie">
            <ng-content select="[pie]"></ng-content>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      z-index: 90;
      padding: 40px 16px;
      overflow-y: auto;
    }
    .modal {
      background: #fff;
      border-radius: 14px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 25px 60px rgba(15, 23, 42, 0.35);
      animation: modal-aparecer 0.18s ease-out;
    }
    .modal-grande {
      max-width: 860px;
    }
    .modal-cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 22px;
      border-bottom: 1px solid #e2e8f0;
    }
    .modal-cabecera h3 {
      margin: 0;
      font-size: 17px;
      color: #0f172a;
    }
    .cerrar {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #64748b;
      line-height: 1;
      padding: 4px;
    }
    .cerrar:hover {
      color: #0f172a;
    }
    .modal-cuerpo {
      padding: 22px;
    }
    .modal-pie {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 22px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 0 0 14px 14px;
    }
    @keyframes modal-aparecer {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
})
export class ModalComponent {
  @Input() visible = false;
  @Input() titulo = '';
  @Input() grande = false;
  @Output() cerrar = new EventEmitter<void>();
}
