import { Component, Input } from '@angular/core';

/** Átomo: tarjeta de indicador (etiqueta + valor) para paneles de resumen. */
@Component({
  selector: 'app-tarjeta-resumen',
  standalone: true,
  template: `
    <div class="resumen-tarjeta">
      <div class="etiqueta">{{ etiqueta }}</div>
      <div [class]="'valor' + (tono ? ' ' + tono : '')">{{ valor }}</div>
    </div>
  `,
  styles: `
    .resumen-tarjeta {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08), 0 4px 14px rgba(15, 23, 42, 0.05);
    }
    .etiqueta {
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 700;
    }
    .valor {
      font-size: 22px;
      font-weight: 700;
      margin-top: 6px;
      color: #0f172a;
    }
    .valor.rojo { color: #dc2626; }
    .valor.verde { color: #16a34a; }
    .valor.azul { color: #2563eb; }
  `,
})
export class TarjetaResumenComponent {
  @Input({ required: true }) etiqueta = '';
  @Input({ required: true }) valor = '';
  @Input() tono?: 'rojo' | 'verde' | 'azul';
}
