import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { extraerError } from './api-error';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  /** GET que normaliza listas: la API devuelve null cuando no hay filas. */
  getList<T>(path: string, params?: HttpParams): Observable<T[]> {
    return this.http.get<T[] | null>(`${this.base}${path}`, { params }).pipe(
      map((res) => res ?? []),
      catchError((err) => throwError(() => extraerError(err)))
    );
  }

  /** GET de un objeto único. */
  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.base}${path}`).pipe(
      catchError((err) => throwError(() => extraerError(err)))
    );
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body).pipe(
      catchError((err) => throwError(() => extraerError(err)))
    );
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body).pipe(
      catchError((err) => throwError(() => extraerError(err)))
    );
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`).pipe(
      catchError((err) => throwError(() => extraerError(err)))
    );
  }
}
