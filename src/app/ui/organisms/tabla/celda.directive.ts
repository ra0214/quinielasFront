import { Directive, Input, TemplateRef } from '@angular/core';

export interface ContextoCelda<T = unknown> {
  $implicit: T;
  fila: T;
}

/**
 * Permite definir contenido personalizado para una columna de `app-tabla`:
 *
 *   <ng-template celda="acciones" let-fila>
 *     <button (click)="editar(fila)">Editar</button>
 *   </ng-template>
 */
// `any` a propósito: permite usar `let-fila` con acceso a propiedades en
// templates estrictos sin castear en cada celda personalizada.
/* eslint-disable @typescript-eslint/no-explicit-any */
@Directive({ selector: '[celda]', standalone: true })
export class CeldaDirective<T = any> {
  @Input({ required: true }) celda = '';

  constructor(public templateRef: TemplateRef<ContextoCelda<T>>) {}
}
