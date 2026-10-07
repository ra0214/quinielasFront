import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/infra/api.service';
import { Saldo, SaldoRequest } from '../../../core/domain/models';

export type FiltroSaldo = 'deben' | 'favor' | 'ceros';

@Injectable({ providedIn: 'root' })
export class SaldosService {
  constructor(private readonly api: ApiService) {}

  listar(filtro?: FiltroSaldo): Observable<Saldo[]> {
    let params = new HttpParams();
    if (filtro) params = params.set('filtro', filtro);
    return this.api.getList<Saldo>('/saldos', params);
  }

  porCliente(idCliente: number): Observable<Saldo> {
    return this.api.get<Saldo>(`/saldos/cliente/${idCliente}`);
  }

  editar(idCliente: number, saldo: SaldoRequest): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/saldos/cliente/${idCliente}`, saldo);
  }
}
