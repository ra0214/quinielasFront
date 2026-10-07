import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/infra/api.service';
import { Edicion, EdicionRequest } from '../../../core/domain/models';

@Injectable({ providedIn: 'root' })
export class EdicionesService {
  constructor(private readonly api: ApiService) {}

  listar(): Observable<Edicion[]> {
    return this.api.getList<Edicion>('/ediciones');
  }

  obtener(id: number): Observable<Edicion> {
    return this.api.get<Edicion>(`/ediciones/${id}`);
  }

  crear(edicion: EdicionRequest): Observable<{ message: string; edicion: Edicion }> {
    return this.api.post<{ message: string; edicion: Edicion }>('/ediciones', edicion);
  }

  actualizar(id: number, edicion: EdicionRequest): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/ediciones/${id}`, edicion);
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/ediciones/${id}`);
  }
}
