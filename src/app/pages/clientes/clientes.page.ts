import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Aporte, Cliente, ClienteRequest, Movimiento, Saldo } from '../../core/domain/models';
import { formatoFecha, formatoMoneda } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { ChipsFiltroComponent, OpcionChip } from '../../ui/molecules/chips-filtro/chips-filtro.component';
import { BuscadorClienteComponent } from '../../ui/molecules/buscador-cliente/buscador-cliente.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { TablaComponent, ColumnaTabla } from '../../ui/organisms/tabla/tabla.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ClientesService } from './data-access/clientes.service';
import { MovimientosService } from '../movimientos/data-access/movimientos.service';
import { AportesService } from '../aportes/data-access/aportes.service';
import { FiltroSaldo, SaldosService } from '../saldos/data-access/saldos.service';
import { QuinielasService } from '../quinielas/data-access/quinielas.service';
import { Quiniela, EstadoQuiniela } from '../../core/domain/models';

type ResultadoQuiniela = 'En juego' | 'Premio' | 'No ganó' | 'Cancelada';

/** Quiniela vista desde la perspectiva de un cliente (su aporte y su resultado). */
interface QuinielaCliente {
  id_quiniela: number;
  variante: string;
  estado: string;
  resultado: ResultadoQuiniela;
  aporte: number;
  fecha_limite: string;
}

/** Devuelve el límite inferior del historial: un mes y una semana hacia atrás. */
function limiteHistorial(): number {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setDate(d.getDate() - 7);
  return d.getTime();
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    IconoComponent,
    FormsModule,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    ChipsFiltroComponent,
    BuscadorClienteComponent,
    TablaComponent,
    CeldaDirective,
    ModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './clientes.page.html',
  styleUrl: './clientes.page.css',
})
export class ClientesPage implements OnInit {
  private readonly datos = inject(ClientesService);
  private readonly movimientosSvc = inject(MovimientosService);
  private readonly aportesSvc = inject(AportesService);
  private readonly saldosSvc = inject(SaldosService);
  private readonly quinielasSvc = inject(QuinielasService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly clientes = signal<Cliente[]>([]);
  readonly saldos = signal<Saldo[]>([]);
  readonly quinielas = signal<Quiniela[]>([]);
  readonly aportesPorCliente = signal<Record<number, Aporte[]>>({});
  cargando = false;
  errorApi = '';

  get totalClientes(): string {
    return String(this.clientes().length);
  }

  // Búsqueda por nombre (con sugerencias) y filtro por saldo
  busqueda = '';
  filtroSaldo: 'todos' | FiltroSaldo = 'todos';
  readonly opcionesSaldo: OpcionChip[] = [
    { etiqueta: 'Todos', valor: 'todos' },
    { etiqueta: 'Deben', valor: 'deben', claseActivo: 'activo-rojo' },
    { etiqueta: 'A favor', valor: 'favor', claseActivo: 'activo-verde' },
    { etiqueta: 'En cero', valor: 'ceros' },
  ];

  /** Clientes visibles tras aplicar la búsqueda por nombre y el filtro de saldo. */
  get clientesFiltrados(): Cliente[] {
    let base = this.clientes();
    const t = this.busqueda.trim().toLowerCase();
    if (t) base = base.filter((c) => c.nombre.toLowerCase().includes(t));
    if (this.filtroSaldo !== 'todos') {
      base = base.filter((c) => {
        const n = this.saldoNeto(c);
        if (this.filtroSaldo === 'deben') return n < 0;
        if (this.filtroSaldo === 'favor') return n > 0;
        return n === 0;
      });
    }
    return base;
  }

  onBusqueda(texto: string): void {
    this.busqueda = texto;
  }

  aplicarFiltroSaldo(valor: string): void {
    this.filtroSaldo = valor as 'todos' | FiltroSaldo;
  }

  readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Nombre' },
    { clave: 'telefono', etiqueta: 'Teléfono' },
    { clave: 'fecha_registro', etiqueta: 'Registro', tipo: 'fecha' },
    { clave: 'quinielas', etiqueta: 'Quinielas jugando (+)', clase: 'acciones', ordenable: false },
    { clave: 'saldo', etiqueta: 'Saldo', tipo: 'moneda', clase: 'num', ordenable: false },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  // Modal crear/editar
  modalVisible = false;
  editandoId: number | null = null;
  formulario: ClienteRequest = { nombre: '', telefono: '' };
  guardando = false;
  errorFormulario = '';

  // Eliminar
  pendiente: Cliente | null = null;

  // Eliminar desde modal
  eliminarDesdeModal = false;
  registrosCargando = false;
  registrosCliente: Cliente | null = null;
  registrosSaldo: Saldo | null = null;
  registrosMovimientos: Movimiento[] = [];
  registrosAportes: Aporte[] = [];
  erroresRegistros: string[] = [];

  registrosVisible = false;

  // Detalle de quinielas del cliente (En juego / Otros)
  detalleVisible = false;
  detalleCliente: Cliente | null = null;
  detalleEnJuego: QuinielaCliente[] = [];
  detalleOtros: QuinielaCliente[] = [];
  detalleCargando = false;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    forkJoin({
      clientes: this.datos.listar(),
      saldos: this.saldosSvc.listar(),
      quinielas: this.quinielasSvc.listar(),
      aportes: this.aportesSvc.listar().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ clientes, saldos, quinielas, aportes }) => {
        this.clientes.set(clientes);
        this.saldos.set(saldos);
        this.quinielas.set(quinielas);
        const mapa: Record<number, Aporte[]> = {};
        for (const a of aportes) {
          if (!mapa[a.id_cliente]) mapa[a.id_cliente] = [];
          mapa[a.id_cliente].push(a);
        }
        this.aportesPorCliente.set(mapa);
        this.cargando = false;
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargando = false;
      },
    });
  }

  nuevo(): void {
    this.editandoId = null;
    this.formulario = { nombre: '', telefono: '' };
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  editar(c: Cliente): void {
    this.editandoId = c.id_cliente;
    this.formulario = { nombre: c.nombre, telefono: c.telefono };
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.guardando = false;
  }

  guardar(): void {
    if (!this.formulario.nombre.trim()) {
      this.errorFormulario = 'El nombre es obligatorio.';
      return;
    }
    this.guardando = true;
    this.errorFormulario = '';

    const peticion =
      this.editandoId === null
        ? this.datos.crear(this.formulario)
        : this.datos.actualizar(this.editandoId, this.formulario);

    peticion.subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Guardado correctamente');
        this.cerrarModal();
        this.cargar();
      },
      error: (e) => {
        this.errorFormulario = e.message;
        this.guardando = false;
      },
    });
  }

  eliminar(c: Cliente): void {
    this.pendiente = c;
  }

  confirmarEliminacion(): void {
    const c = this.pendiente;
    if (!c) return;
    this.datos.eliminar(c.id_cliente).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Cliente eliminado');
        this.pendiente = null;
        this.cargar();
      },
      error: (e) => {
        this.toast.error(e.message);
        // Si falla por registros asociados (409), mostramos qué registros tiene.
        if (e.status === 409) {
          this.abrirRegistros(c);
        }
        this.pendiente = null;
      },
    });
  }

  private abrirRegistros(c: Cliente): void {
    this.registrosCliente = c;
    this.registrosSaldo = null;
    this.registrosMovimientos = [];
    this.registrosAportes = [];
    this.erroresRegistros = [];
    this.registrosVisible = true;
    this.registrosCargando = true;

    const saldo$ = this.saldosSvc
      .porCliente(c.id_cliente)
      .pipe(catchError(() => of(null)));
    const movimientos$ = this.movimientosSvc.porCliente(c.id_cliente).pipe(catchError(() => of([])));
    const aportes$ = this.aportesSvc.porCliente(c.id_cliente).pipe(catchError(() => of([])));

    forkJoin({ saldo: saldo$, movimientos: movimientos$, aportes: aportes$ }).subscribe({
      next: ({ saldo, movimientos, aportes }) => {
        this.registrosSaldo = saldo;
        this.registrosMovimientos = movimientos;
        this.registrosAportes = aportes;
        this.registrosCargando = false;
      },
      error: (e) => {
        this.erroresRegistros.push(e.message);
        this.registrosCargando = false;
      },
    });
  }

  cerrarRegistros(): void {
    this.registrosVisible = false;
    this.registrosCliente = null;
  }

  // ===== Atajos de ver registros =====
  moneda(v: number | null | undefined): string {
    return formatoMoneda(v);
  }

  fecha(v: string): string {
    return formatoFecha(v);
  }

  verMovimientosCliente(): void {
    const c = this.registrosCliente;
    if (!c) return;
    this.cerrarRegistros();
    this.router.navigate(['/movimientos'], { queryParams: { cliente: c.id_cliente } });
  }

  verMovimientos(c: Cliente): void {
    this.router.navigate(['/movimientos'], { queryParams: { cliente: c.id_cliente } });
  }

  saldoDeCliente(c: Cliente): Saldo | undefined {
    return this.saldos().find((s) => s.id_cliente === c.id_cliente);
  }

  saldoNeto(c: Cliente): number {
    const s = this.saldoDeCliente(c);
    if (!s) return 0;
    return (s.saldo_favor ?? 0) - (s.saldo_deuda ?? 0);
  }

  saldoTexto(c: Cliente): string {
    const n = this.saldoNeto(c);
    return formatoMoneda(n);
  }

  saldoClase(c: Cliente): string {
    const n = this.saldoNeto(c);
    if (n > 0) return 'saldo-verde';
    if (n < 0) return 'saldo-rojo';
    return 'saldo-neutro';
  }

  quinielasJugando(c: Cliente): Quiniela[] {
    const list = this.quinielas().filter((q) => q.estado === 'EN_JUEGO');
    const mapA = this.aportesPorCliente()[c.id_cliente] || [];
    const ids = new Set(mapA.map((a) => a.id_quiniela));
    if (ids.size === 0) return [];
    return list.filter((q) => ids.has(q.id_quiniela));
  }

  countQuinielasJugando(c: Cliente): number {
    return this.quinielasJugando(c).length;
  }

  /** Aporte total que el cliente hizo en una quiniela (o lo pagado si es comprador DIRECTA). */
  private aporteDeCliente(c: Cliente, q: Quiniela, mapAportes: Map<number, number>): number {
    const delAporte = mapAportes.get(q.id_quiniela);
    if (delAporte !== undefined) return delAporte;
    if (q.id_cliente === c.id_cliente) return q.monto_pagado ?? q.monto_meta ?? 0;
    return 0;
  }

  abrirDetalleQuinielas(c: Cliente): void {
    this.detalleCliente = c;
    this.detalleEnJuego = [];
    this.detalleOtros = [];
    this.detalleVisible = true;
    this.detalleCargando = true;

    const mapAportes = new Map<number, number>();
    for (const a of this.aportesPorCliente()[c.id_cliente] || []) {
      mapAportes.set(a.id_quiniela, (mapAportes.get(a.id_quiniela) ?? 0) + (a.monto_total_acumulado ?? 0));
    }

    // El premio se reconoce por el abono PREMIO_ABONO registrado al cliente.
    this.movimientosSvc
      .porCliente(c.id_cliente)
      .pipe(catchError(() => of([])))
      .subscribe({
        next: (movimientos) => {
          const ganadoras = new Set<number>();
          for (const m of movimientos) {
            if (m.tipo === 'PREMIO_ABONO' && m.id_quiniela != null) {
              ganadoras.add(m.id_quiniela);
            }
          }

          const limite = limiteHistorial();
          const enJuego: QuinielaCliente[] = [];
          const otros: QuinielaCliente[] = [];

          for (const q of this.quinielas()) {
            const participa = mapAportes.has(q.id_quiniela) || q.id_cliente === c.id_cliente;
            if (!participa) continue;

            const base = {
              id_quiniela: q.id_quiniela,
              variante: q.nombre_variante,
              estado: q.estado,
              aporte: this.aporteDeCliente(c, q, mapAportes),
              fecha_limite: q.fecha_limite,
            };

            if (q.estado === 'EN_JUEGO') {
              enJuego.push({ ...base, resultado: 'En juego' });
              continue;
            }

            // "Otros": solo las pasadas dentro del último mes y una semana.
            const fecha = q.fecha_limite ? new Date(q.fecha_limite).getTime() : NaN;
            if (!isNaN(fecha) && fecha < limite) continue;

            let resultado: ResultadoQuiniela = 'No ganó';
            if (q.estado === 'CANCELADA') resultado = 'Cancelada';
            else if (ganadoras.has(q.id_quiniela)) resultado = 'Premio';

            otros.push({ ...base, resultado });
          }

          enJuego.sort((a, b) => b.fecha_limite.localeCompare(a.fecha_limite));
          otros.sort((a, b) => b.fecha_limite.localeCompare(a.fecha_limite));

          this.detalleEnJuego = enJuego;
          this.detalleOtros = otros;
          this.detalleCargando = false;
        },
        error: () => {
          this.detalleCargando = false;
        },
      });
  }

  cerrarDetalle(): void {
    this.detalleVisible = false;
    this.detalleCliente = null;
    this.detalleEnJuego = [];
    this.detalleOtros = [];
  }

  resultadoClase(r: ResultadoQuiniela): string {
    switch (r) {
      case 'Premio':
        return 'resultado-premio';
      case 'No ganó':
        return 'resultado-no-gano';
      case 'Cancelada':
        return 'resultado-cancelada';
      default:
        return 'resultado-en-juego';
    }
  }

}
