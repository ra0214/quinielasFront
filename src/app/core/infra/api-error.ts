import { HttpErrorResponse } from '@angular/common/http';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function extraerError(err: HttpErrorResponse): ApiError {
  const cuerpo = err.error;
  if (cuerpo && typeof cuerpo === 'object' && typeof cuerpo.error === 'string' && cuerpo.error) {
    return new ApiError(cuerpo.error + (cuerpo.detalles ? ` (${cuerpo.detalles})` : ''), err.status);
  }
  if (typeof cuerpo === 'string' && cuerpo.trim()) {
    return new ApiError(cuerpo, err.status);
  }
  return new ApiError(err.message || 'Error de conexión con la API', err.status);
}
