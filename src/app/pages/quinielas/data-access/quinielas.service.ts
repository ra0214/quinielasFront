import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/infra/api.service';
import { Quiniela, QuinielaRequest } from '../../../core/domain/models';

@Injectable({ providedIn: 'root' })
export class QuinielasService {
  constructor(private readonly api: ApiService) {}

  listar(): Observable<Quiniela[]> {
    return this.api.getList<Quiniela>('/quinielas');
  }

  porEdicion(idEdicion: number): Observable<Quiniela[]> {
    return this.api.getList<Quiniela>(`/quinielas/edicion/${idEdicion}`);
  }

  obtener(id: number): Observable<Quiniela> {
    return this.api.get<Quiniela>(`/quinielas/${id}`);
  }

  crear(quiniela: QuinielaRequest): Observable<{ message: string; quiniela: Quiniela }> {
    return this.api.post<{ message: string; quiniela: Quiniela }>('/quinielas', quiniela);
  }

  actualizar(id: number, quiniela: QuinielaRequest): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/quinielas/${id}`, quiniela);
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/quinielas/${id}`);
  }
}
