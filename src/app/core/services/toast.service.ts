import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  tipo: 'exito' | 'error' | 'info';
  texto: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  exito(texto: string): void {
    this.mostrar('exito', texto);
  }

  error(texto: string): void {
    this.mostrar('error', texto);
  }

  info(texto: string): void {
    this.mostrar('info', texto);
  }

  private mostrar(tipo: Toast['tipo'], texto: string): void {
    const id = ++this.seq;
    this.toasts.update((lista) => [...lista, { id, tipo, texto }]);
    setTimeout(() => this.cerrar(id), 4000);
  }

  cerrar(id: number): void {
    this.toasts.update((lista) => lista.filter((t) => t.id !== id));
  }
}
