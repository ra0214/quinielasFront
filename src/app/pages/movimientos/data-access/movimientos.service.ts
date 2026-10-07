import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/infra/api.service';
import { Movimiento, MovimientoRequest } from '../../../core/domain/models';

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  constructor(private readonly api: ApiService) {}

  listar(): Observable<Movimiento[]> {
    return this.api.getList<Movimiento>('/movimientos');
  }

  porCliente(idCliente: number): Observable<Movimiento[]> {
    return this.api.getList<Movimiento>(`/movimientos/cliente/${idCliente}`);
  }

  crear(movimiento: MovimientoRequest): Observable<{ message: string; movimiento: Movimiento }> {
    return this.api.post<{ message: string; movimiento: Movimiento }>('/movimientos', movimiento);
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/movimientos/${id}`);
  }
}
