import { Component, Input } from '@angular/core';

export type VarianteBadge =
  | 'en_juego'
  | 'completada'
  | 'cancelada'
  | 'info'
  | 'verde'
  | 'rojo'
  | 'gris';

/**
 * Átomo: etiqueta de estado/tipo.
 * Si no se indica `variante`, se deduce del texto (estados de quiniela y tipos de movimiento).
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span [class]="'badge badge-' + varianteResuelta">{{ etiqueta || valor }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .badge-en_juego { background: #fef3c7; color: #92400e; }
    .badge-completada { background: #dbeafe; color: #1e40af; }
    .badge-cancelada { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #e0f2fe; color: #075985; }
    .badge-verde { background: #dcfce7; color: #166534; }
    .badge-rojo { background: #fee2e2; color: #991b1b; }
    .badge-gris { background: #f1f5f9; color: #475569; }
  `,
})
export class BadgeComponent {
  @Input({ required: true }) valor = '';
  /** Texto alternativo a mostrar (opcional). */
  @Input() etiqueta = '';
  @Input() variante?: VarianteBadge;

  get varianteResuelta(): VarianteBadge {
    if (this.variante) return this.variante;
    const v = this.valor.toUpperCase();
    if (v === 'EN_JUEGO') return 'en_juego';
    if (v === 'COMPLETADA') return 'completada';
    if (v === 'CANCELADA') return 'cancelada';
    if (v.startsWith('PAGO')) return 'verde';
    if (v === 'FIADO') return 'gris';
    if (v === 'RETIRO') return 'rojo';
    if (v === 'PREMIO_ABONO' || v === 'DEVOLUCION') return 'info';
    return 'gris';
  }
}
