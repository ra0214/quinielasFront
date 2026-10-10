import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/infra/api.service';
import { Premio, PremioRequest, RepartoPremio } from '../../../core/domain/models';

@Injectable({ providedIn: 'root' })
export class PremiosService {
  constructor(private readonly api: ApiService) {}

  listar(): Observable<Premio[]> {
    return this.api.getList<Premio>('/premios');
  }

  porQuiniela(idQuiniela: number): Observable<Premio> {
    return this.api.get<Premio>(`/premios/quiniela/${idQuiniela}`);
  }

  crear(premio: PremioRequest): Observable<{ message: string; premio: Premio }> {
    return this.api.post<{ message: string; premio: Premio }>('/premios', premio);
  }

  actualizar(id: number, montoBruto: number): Observable<{ message: string; premio: Premio }> {
    return this.api.put<{ message: string; premio: Premio }>(`/premios/${id}`, { monto_bruto: montoBruto });
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/premios/${id}`);
  }

  obtenerReparto(idQuiniela: number): Observable<RepartoPremio> {
    return this.api.get<RepartoPremio>(`/premios/quiniela/${idQuiniela}/reparto`);
  }

  generarReparto(idQuiniela: number): Observable<{ message: string; reparto: RepartoPremio }> {
    return this.api.post<{ message: string; reparto: RepartoPremio }>(
      `/premios/quiniela/${idQuiniela}/reparto`,
      {}
    );
  }
}
