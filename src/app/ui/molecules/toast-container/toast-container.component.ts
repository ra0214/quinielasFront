import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { IconoComponent } from '../../atoms/icono/icono.component';

/** Molécula/organismo: contenedor de notificaciones flotantes (esquina inferior derecha). */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [IconoComponent],
  template: `
    <div class="toasts">
      @for (t of toast.toasts(); track t.id) {
        <div [class]="'toast toast-' + t.tipo" (click)="toast.cerrar(t.id)">
          <span>
            @switch (t.tipo) {
              @case ('exito') { <app-icono nombre="verificar" tamano="16px" /> }
              @case ('error') { <app-icono nombre="alerta" tamano="16px" /> }
              @default { <app-icono nombre="info" tamano="16px" /> }
            }
          </span>
          {{ t.texto }}
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: 18px;
      bottom: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 200;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 9px;
      background: #0f172a;
      color: #fff;
      padding: 12px 16px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
      cursor: pointer;
      max-width: 380px;
      font-size: 13.5px;
      animation: toast-aparecer 0.2s ease-out;
      border-left: 4px solid #64748b;
      font-family: inherit;
      text-align: left;
      border-top: none;
      border-right: none;
      border-bottom: none;
    }
    .toast-exito { border-left-color: #16a34a; }
    .toast-error { border-left-color: #dc2626; }
    .toast-info { border-left-color: #2563eb; }
    @keyframes toast-aparecer {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
})
export class ToastContainerComponent {
  readonly toast = inject(ToastService);
}
