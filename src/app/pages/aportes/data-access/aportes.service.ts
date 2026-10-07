import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/infra/api.service';
import { Aporte, AporteDetalle, AporteRequest } from '../../../core/domain/models';

@Injectable({ providedIn: 'root' })
export class AportesService {
  constructor(private readonly api: ApiService) {}

  porQuiniela(idQuiniela: number): Observable<AporteDetalle[]> {
    return this.api.getList<AporteDetalle>(`/aportes/quiniela/${idQuiniela}`);
  }

  porCliente(idCliente: number): Observable<Aporte[]> {
    return this.api.getList<Aporte>(`/aportes/cliente/${idCliente}`);
  }

  crear(aporte: AporteRequest): Observable<{ message: string; aporte: Aporte }> {
    return this.api.post<{ message: string; aporte: Aporte }>('/aportes', aporte);
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/aportes/${id}`);
  }
}
