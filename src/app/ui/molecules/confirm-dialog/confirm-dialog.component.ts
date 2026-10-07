import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Diálogo de confirmación reutilizable (para eliminar registros).
 * Uso:
 *   <app-confirm-dialog
 *     [visible]="!!pendiente"
 *     titulo="Eliminar cliente"
 *     [mensaje]="'¿Seguro que deseas eliminar a ' + pendiente?.nombre + '?'"
 *     (confirmar)="confirmar()"
 *     (cancelar)="pendiente = null">
 *   </app-confirm-dialog>
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (visible) {
      <div class="overlay" (click)="cancelar.emit()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <h3>{{ titulo }}</h3>
          <p>{{ mensaje }}</p>
          <div class="dialog-acciones">
            <button type="button" class="btn btn-ghost" (click)="cancelar.emit()">Cancelar</button>
            <button type="button" class="btn btn-peligro" (click)="confirmar.emit()">
              {{ textoConfirmar }}
            </button>
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
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 16px;
    }
    .dialog {
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3);
    }
    .dialog h3 {
      margin: 0 0 8px;
      font-size: 18px;
      color: #0f172a;
    }
    .dialog p {
      margin: 0 0 20px;
      color: #475569;
      line-height: 1.5;
      white-space: pre-line;
    }
    .dialog-acciones {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    @media (max-width: 560px) {
      .overlay {
        align-items: flex-end;
        padding: 12px;
      }
      .dialog {
        border-radius: 14px;
      }
      .dialog-acciones {
        flex-direction: column-reverse;
      }
      .dialog-acciones .btn {
        width: 100%;
      }
    }
  `,
})
export class ConfirmDialogComponent {
  @Input() visible = false;
  @Input() titulo = 'Confirmar';
  @Input() mensaje = '¿Deseas continuar?';
  @Input() textoConfirmar = 'Eliminar';
  @Output() confirmar = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();
}
