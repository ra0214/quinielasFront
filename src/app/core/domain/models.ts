// Modelos TypeScript — reflejan exactamente los tags json (snake_case) de la API Go.

export interface Cliente {
  id_cliente: number;
  nombre: string;
  telefono: string;
  fecha_registro: string;
}

export interface ClienteRequest {
  nombre: string;
  telefono: string;
}

export interface Edicion {
  id_edicion: number;
  tipo_edicion: string;
  nombre_edicion: string;
  fecha_inicio: string;
}

export interface EdicionRequest {
  tipo_edicion: string;
  nombre_edicion: string;
}

export type EstadoQuiniela = 'EN_JUEGO' | 'COMPLETADA' | 'CANCELADA';

export type TipoQuiniela = 'DIRECTA' | 'DIRECTA_EN_COPERACHA' | 'DESARROLLO';

export type TipoPagoQuiniela = 'CONTADO' | 'PAGO_PARCIAL' | 'A_CREDITO';

export interface Quiniela {
  id_quiniela: number;
  id_edicion: number;
  nombre_variante: string;
  precio: number;
  monto_meta: number;
  fecha_limite: string;
  estado: EstadoQuiniela | string;
  tipo_quiniela?: TipoQuiniela | string;
  id_cliente?: number | null;
  monto_pagado?: number;
  cantidad_boletos?: number;
  analista?: string;
  tipo_pago?: TipoPagoQuiniela | string;
}

export interface QuinielaRequest {
  id_edicion: number;
  nombre_variante: string;
  precio: number;
  monto_meta: number;
  fecha_limite: string; // RFC3339 estricto
  estado?: string;
  tipo_quiniela?: string;
  id_cliente?: number | null;
  monto_pagado?: number;
  cantidad_boletos?: number;
  analista?: string;
  tipo_pago?: string;
}

export interface Saldo {
  id_cliente: number;
  saldo_favor: number;
  saldo_deuda: number;
}

export interface SaldoRequest {
  saldo_favor: number;
  saldo_deuda: number;
}

export interface Aporte {
  id_aporte: number;
  id_cliente: number;
  id_quiniela: number;
  monto_total_acumulado: number;
  porcentaje_participacion: number;
}

export interface AporteDetalle extends Aporte {
  nombre_cliente: string;
}

export interface AporteRequest {
  id_cliente: number;
  id_quiniela: number;
  monto: number;
}

export type TipoMovimiento =
  | 'PAGO_EFECTIVO'
  | 'PAGO_SALDO'
  | 'FIADO'
  | 'RETIRO'
  | 'PREMIO_ABONO'
  | 'DEVOLUCION';

export interface Movimiento {
  id_movimiento: number;
  id_cliente: number;
  id_quiniela?: number;
  tipo: TipoMovimiento | string;
  monto: number;
  descripcion: string;
  fecha: string;
}

export interface MovimientoRequest {
  id_cliente: number;
  id_quiniela?: number | null;
  tipo: string;
  monto: number;
  descripcion: string;
}

export interface Premio {
  id_premio: number;
  id_quiniela: number;
  monto_bruto: number;
  porcentaje_retencion: number;
  monto_neto: number;
  fecha_registro: string;
}

export interface PremioRequest {
  id_quiniela: number;
  monto_bruto: number;
}

export interface ParticipanteReparto {
  id_cliente: number;
  nombre_cliente: string;
  monto_aporte: number;
  porcentaje_aporte: number;
  porcentaje_sobre_meta: number;
  porcentaje_recompensa: number;
  monto_bruto_asignado: number;
  monto_retencion: number;
  monto_neto_asignado: number;
}

export interface RepartoPremio {
  id_premio: number;
  id_quiniela: number;
  monto_bruto: number;
  porcentaje_retencion: number;
  monto_neto: number;
  total_recaudado: number;
  monto_meta: number;
  porcentaje_meta_alcanzado: number;
  total_participantes: number;
  participantes: ParticipanteReparto[];
  fecha_reparto: string;
}
