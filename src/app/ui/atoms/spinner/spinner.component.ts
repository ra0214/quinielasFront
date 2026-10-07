import { Component, Input } from '@angular/core';

/** Átomo: indicador de carga. */
@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `<span class="spinner" role="status">{{ texto }}</span>`,
  styles: `
    .spinner {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #64748b;
      font-size: 13.5px;
    }
    .spinner::before {
      content: '';
      width: 14px;
      height: 14px;
      border: 2px solid #cbd5e1;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: girar 0.7s linear infinite;
    }
    @keyframes girar {
      to { transform: rotate(360deg); }
    }
  `,
})
export class SpinnerComponent {
  @Input() texto = 'Cargando…';
}
