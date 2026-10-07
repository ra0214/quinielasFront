import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/infra/api.service';
import { Cliente, ClienteRequest } from '../../../core/domain/models';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  constructor(private readonly api: ApiService) {}

  listar(): Observable<Cliente[]> {
    return this.api.getList<Cliente>('/clientes');
  }

  buscar(termino: string): Observable<Cliente[]> {
    const params = new HttpParams().set('q', termino);
    return this.api.getList<Cliente>('/clientes/search', params);
  }

  crear(cliente: ClienteRequest): Observable<{ message: string; cliente: Cliente }> {
    return this.api.post<{ message: string; cliente: Cliente }>('/clientes', cliente);
  }

  actualizar(id: number, cliente: ClienteRequest): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/clientes/${id}`, cliente);
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/clientes/${id}`);
  }
}
