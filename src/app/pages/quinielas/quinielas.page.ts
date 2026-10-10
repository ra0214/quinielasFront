import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AporteDetalle, Cliente, Edicion, EstadoQuiniela, Quiniela, QuinielaRequest, TipoPagoQuiniela, TipoQuiniela } from '../../core/domain/models';
import { aRfc3339, deRfc3339AInput, formatoMoneda } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ChipsFiltroComponent, OpcionChip } from '../../ui/molecules/chips-filtro/chips-filtro.component';
import { ConfirmDialogComponent } from '../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { AportesService } from '../aportes/data-access/aportes.service';
import { ClientesService } from '../clientes/data-access/clientes.service';
import { EdicionesService } from '../ediciones/data-access/ediciones.service';
import { QuinielasService } from './data-access/quinielas.service';

/** Quiniela enriquecida con el nombre de su edición para mostrar y ordenar. */
interface QuinielaVista extends Quiniela {
  nombre_edicion: string;
}

interface ProgresoQuiniela {
  recaudado: number;
  faltante: number;
  porcentaje: number;
}

interface FormularioQuiniela {
  id_edicion: number;
  nombre_variante: string;
  precio: number | null; // precio por boleto (DIRECTA/COPERACHA) o costo total (DESARROLLO)
  cantidad_boletos: number | null; // solo DIRECTA_EN_COPERACHA
  monto_meta: number | null;
  fecha_limite: string; // valor de input datetime-local
  estado: string;
  tipo_quiniela: TipoQuiniela;
  id_cliente: number; // 0 = sin seleccionar
  tipo_pago: TipoPagoQuiniela;
  monto_pagado: number | null; // solo PAGO_PARCIAL
}

@Component({
  selector: 'app-quinielas',
  standalone: true,
  imports: [
    IconoComponent,
    FormsModule,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    ChipsFiltroComponent,
    TablaComponent,
    CeldaDirective,
    ModalComponent,
    ConfirmDialogComponent,
    BadgeComponent,
  ],
  templateUrl: './quinielas.page.html',
  styleUrl: './quinielas.page.css',
})
export class QuinielasPage implements OnInit {
  private readonly datos = inject(QuinielasService);
  private readonly edicionesSvc = inject(EdicionesService);
  private readonly clientesSvc = inject(ClientesService);
  private readonly aportes = inject(AportesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly quinielas = signal<QuinielaVista[]>([]);
  readonly ediciones = signal<Edicion[]>([]);
  readonly clientes = signal<Cliente[]>([]);
  readonly progresos = signal<Record<number, ProgresoQuiniela>>({});
  cargando = false;
  errorApi = '';

  readonly variantes = ['Neto', 'Otros', 'Tlacuache', 'Salomón', 'Extra'];
  readonly estados: EstadoQuiniela[] = ['EN_JUEGO', 'COMPLETADA', 'CANCELADA'];
  readonly tiposQuiniela: { valor: TipoQuiniela; etiqueta: string }[] = [
    { valor: 'DIRECTA', etiqueta: 'Directa' },
    { valor: 'DIRECTA_EN_COPERACHA', etiqueta: 'Directa en coperacha' },
    { valor: 'DESARROLLO', etiqueta: 'Desarrollo' },
  ];
  readonly tiposPago: { valor: TipoPagoQuiniela; etiqueta: string }[] = [
    { valor: 'CONTADO', etiqueta: 'Pagado (contado)' },
    { valor: 'PAGO_PARCIAL', etiqueta: 'Pago parcial' },
    { valor: 'A_CREDITO', etiqueta: 'A crédito (pendiente)' },
  ];

  // Filtros
  filtroEstado: 'TODAS' | EstadoQuiniela = 'TODAS';
  filtroEdicion = 0; // 0 = todas las ediciones

  readonly opcionesFiltroEstado: OpcionChip[] = [
    { etiqueta: 'Todas', valor: 'TODAS' },
    { etiqueta: 'En juego', valor: 'EN_JUEGO', claseActivo: 'activo-verde' },
    { etiqueta: 'Completadas', valor: 'COMPLETADA' },
    { etiqueta: 'Canceladas', valor: 'CANCELADA', claseActivo: 'activo-rojo' },
  ];

  readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre_edicion', etiqueta: 'NÚMERO' },
    { clave: 'nombre_variante', etiqueta: 'ANALISTA' },
    { clave: 'tipo', etiqueta: 'Tipo', ordenable: false },
    { clave: 'precio', etiqueta: 'Precio', tipo: 'moneda', clase: 'num' },
    { clave: 'pago', etiqueta: 'Estado de pago', ordenable: false },
    { clave: 'monto_meta', etiqueta: 'Meta', tipo: 'moneda', clase: 'num' },
    { clave: 'fecha_limite', etiqueta: 'Fecha límite', tipo: 'fecha' },
    { clave: 'progreso', etiqueta: 'Progreso', ordenable: false },
    { clave: 'estado', etiqueta: 'Estado' },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  // Modal crear/editar
  modalVisible = false;
  editandoId: number | null = null;
  formulario: FormularioQuiniela = this.formularioVacio();
  guardando = false;
  errorFormulario = '';

  // Eliminar
  pendiente: QuinielaVista | null = null;

  // Modal registrar aporte (misma ventana)
  aporteVisible = false;


  tipoQuiniela: 'DIRECTA' | 'DIRECTA_EN_COPERACHA' | 'DESARROLLO' = 'DIRECTA';
  clienteSeleccionado: number = 0;
  cantidadBoletos: number | null = null;
  aportandoQuiniela: QuinielaVista | null = null;
  aporteForm: { id_cliente: number; monto: number | null } = { id_cliente: 0, monto: null };
  guardandoAporte = false;
  errorAporte = '';

  ngOnInit(): void {
    this.cargar();
  }

  private formularioVacio(): FormularioQuiniela {
    const primera = this.ediciones()[0];
    const primerCliente = this.clientes()[0]?.id_cliente ?? 0;
    return {
      id_edicion: primera ? primera.id_edicion : 0,
      nombre_variante: 'Neto',
      precio: null,
      cantidad_boletos: 1,
      monto_meta: null,
      fecha_limite: '',
      estado: 'EN_JUEGO',
      tipo_quiniela: 'DIRECTA',
      id_cliente: primerCliente,
      tipo_pago: 'CONTADO',
      monto_pagado: null,
    };
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    forkJoin({
      quinielas: this.datos.listar(),
      ediciones: this.edicionesSvc.listar(),
      clientes: this.clientesSvc.listar(),
    }).subscribe({
      next: ({ quinielas, ediciones, clientes }) => {
        this.ediciones.set(ediciones);
        this.clientes.set(clientes);
        const nombres = new Map(ediciones.map((e) => [e.id_edicion, e.nombre_edicion]));
        this.quinielas.set(
          quinielas.map((q) => ({
            ...q,
            nombre_edicion: nombres.get(q.id_edicion) ?? `Edición #${q.id_edicion}`,
          }))
        );
        this.cargando = false;
        this.cargarProgresos(quinielas);
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargando = false;
      },
    });
  }

  /** recaudación por quiniela; los fallos individuales se manejan en silencio. */
  private cargarProgresos(lista: Quiniela[]): void {
    if (lista.length === 0) {
      this.progresos.set({});
      return;
    }
    const peticiones = lista.map((q) =>
      this.aportes.porQuiniela(q.id_quiniela).pipe(
        catchError(() => of<AporteDetalle[] | null>(null)),
        map((aportes) => {
          if (!aportes) return null;
          const recaudado = aportes.reduce((suma, a) => suma + (a.monto_total_acumulado || 0), 0);
          const meta = q.monto_meta || 0;
          const faltante = meta - recaudado;
          const porcentaje = meta > 0 ? (recaudado / meta) * 100 : 0;
          return [q.id_quiniela, { recaudado, faltante, porcentaje }] as const;
        })
      )
    );
    forkJoin(peticiones).subscribe({
      next: (entradas) => {
        const mapa: Record<number, ProgresoQuiniela> = {};
        for (const entrada of entradas) {
          if (entrada) mapa[entrada[0]] = entrada[1];
        }
        this.progresos.set(mapa);
      },
      error: () => undefined,
    });
  }

  /** Filas visibles: se aplican los filtros; la tabla ordena internamente. */
  get lista(): QuinielaVista[] {
    let base = this.quinielas();
    if (this.filtroEstado !== 'TODAS') {
      base = base.filter((q) => q.estado === this.filtroEstado);
    }
    if (this.filtroEdicion !== 0) {
      base = base.filter((q) => q.id_edicion === this.filtroEdicion);
    }
    return base;
  }

  cambiarFiltroEstado(valor: string): void {
    this.filtroEstado = valor as 'TODAS' | EstadoQuiniela;
  }

  get totalQuinielas(): string {
    return String(this.quinielas().length);
  }

  contar(estado: EstadoQuiniela): string {
    return String(this.quinielas().filter((q) => q.estado === estado).length);
  }

  etiquetaEstado(estado: string): string {
    switch (estado) {
      case 'EN_JUEGO':
        return 'En juego';
      case 'COMPLETADA':
        return 'Completada';
      case 'CANCELADA':
        return 'Cancelada';
      default:
        return estado || '—';
    }
  }

  progreso(id: number): ProgresoQuiniela | null {
    return this.progresos()[id] ?? null;
  }

  moneda(v: number): string {
    return formatoMoneda(v);
  }

  /** Total a cobrar al cliente según el tipo de quiniela. */
  totalCobrar(q: Quiniela): number {
    const precio = q.precio || 0;
    if (q.tipo_quiniela === 'DIRECTA_EN_COPERACHA') {
      const cant = q.cantidad_boletos || 1;
      return precio * cant;
    }
    return precio;
  }

  totalCobrarForm(f: FormularioQuiniela): number {
    if (f.tipo_quiniela === 'DIRECTA_EN_COPERACHA') {
      return (f.precio ?? 0) * (f.cantidad_boletos ?? 1);
    }
    return f.precio ?? 0;
  }

  etiquetaTipo(valor: string): string {
    switch (valor) {
      case 'DIRECTA':
        return 'Directa';
      case 'DIRECTA_EN_COPERACHA':
        return 'Directa en coperacha';
      case 'DESARROLLO':
        return 'Desarrollo';
      default:
        return valor || '—';
    }
  }

  /** Estado de pago mostrado en la tabla. */
  estadoPago(q: Quiniela): { texto: string; clase: string } {
    const pagado = q.monto_pagado || 0;
    const total = this.totalCobrar(q);
    if (!q.id_cliente || total === 0) {
      return { texto: '—', clase: 'saldo-cero' };
    }
    if (pagado <= 0) {
      return { texto: 'Pendiente / Fiado', clase: 'texto-rojo' };
    }
    if (pagado >= total) {
      return { texto: 'Pagado', clase: 'texto-verde' };
    }
    return { texto: `Pago parcial (${this.moneda(pagado)}/${this.moneda(total)})`, clase: 'texto-amarillo' };
  }

  refrescarMontoPagado(): void {
    const f = this.formulario;
    const total = this.totalCobrarForm(f);
    if (f.tipo_pago === 'CONTADO') {
      f.monto_pagado = total;
    } else if (f.tipo_pago === 'A_CREDITO') {
      f.monto_pagado = 0;
    }
  }

  nombreCliente(id: number | null | undefined): string {
    if (!id) return 'Sin cliente';
    const c = this.clientes().find((x) => x.id_cliente === id);
    return c ? c.nombre : `Cliente #${id}`;
  }

  nuevo(): void {
    this.editandoId = null;
    this.formulario = this.formularioVacio();
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  editar(q: QuinielaVista): void {
    this.editandoId = q.id_quiniela;
    this.formulario = {
      id_edicion: q.id_edicion,
      nombre_variante: q.nombre_variante,
      precio: q.precio,
      cantidad_boletos: q.cantidad_boletos || 1,
      monto_meta: q.monto_meta,
      fecha_limite: deRfc3339AInput(q.fecha_limite),
      estado: q.estado,
      tipo_quiniela: (q.tipo_quiniela as TipoQuiniela) || 'DIRECTA',
      id_cliente: q.id_cliente ?? 0,
      tipo_pago: (q.tipo_pago as TipoPagoQuiniela) || 'A_CREDITO',
      monto_pagado: q.monto_pagado ?? null,
    };
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.guardando = false;
  }

  guardar(): void {
    const f = this.formulario;
    if (this.editandoId === null && !f.id_edicion) {
      this.errorFormulario = this.ediciones().length
        ? 'Selecciona la edición de la quiniela.'
        : 'Primero debes crear una edición.';
      return;
    }
    if (!f.nombre_variante) {
      this.errorFormulario = 'Selecciona la variante de la quiniela.';
      return;
    }
    if (!f.tipo_quiniela) {
      this.errorFormulario = 'Selecciona el tipo de quiniela.';
      return;
    }
    if (f.precio == null || f.precio <= 0) {
      this.errorFormulario = 'El precio es obligatorio y debe ser mayor a 0.';
      return;
    }
    if (f.tipo_quiniela === 'DIRECTA_EN_COPERACHA' && (!f.cantidad_boletos || f.cantidad_boletos < 1)) {
      this.errorFormulario = 'La cantidad de boletos debe ser al menos 1.';
      return;
    }
    const total = this.totalCobrarForm(f);
    if (!f.id_cliente) {
      this.errorFormulario = 'Selecciona el cliente que paga la quiniela.';
      return;
    }
    let montoPagado = 0;
    if (f.tipo_pago === 'CONTADO') {
      montoPagado = total;
    } else if (f.tipo_pago === 'PAGO_PARCIAL') {
      if (f.monto_pagado == null || f.monto_pagado <= 0) {
        this.errorFormulario = 'Indica el monto pagado en el pago parcial.';
        return;
      }
      if (f.monto_pagado > total) {
        this.errorFormulario = 'El monto pagado no puede superar el total a cobrar.';
        return;
      }
      montoPagado = f.monto_pagado;
    }
    if (f.monto_meta != null && f.monto_meta < 0) {
      this.errorFormulario = 'El monto meta no puede ser negativo.';
      return;
    }
    if (!f.fecha_limite) {
      this.errorFormulario = 'La fecha y hora límite es obligatoria.';
      return;
    }
    if (this.editandoId !== null && !f.estado) {
      this.errorFormulario = 'Selecciona el estado de la quiniela.';
      return;
    }
    if (this.editandoId === null) {
      const deEstaEdicion = this.quinielas().filter((q) => q.id_edicion === f.id_edicion).length;
      if (deEstaEdicion >= 5) {
        this.errorFormulario = 'Se alcanzó el límite de 5 quinielas por edición.';
        return;
      }
    }

    const cuerpo: QuinielaRequest = {
      id_edicion: f.id_edicion,
      nombre_variante: f.nombre_variante,
      precio: f.precio ?? 0,
      monto_meta: f.monto_meta ?? 0,
      fecha_limite: aRfc3339(f.fecha_limite),
      tipo_quiniela: f.tipo_quiniela,
      id_cliente: f.id_cliente,
      monto_pagado: montoPagado,
      cantidad_boletos: f.tipo_quiniela === 'DIRECTA_EN_COPERACHA' ? (f.cantidad_boletos ?? 1) : 0,
      analista: f.nombre_variante,
      tipo_pago: f.tipo_pago,
    };
    this.guardando = true;
    this.errorFormulario = '';

    // POST sin estado: la quiniela nace EN_JUEGO.
    const peticion =
      this.editandoId === null
        ? this.datos.crear(cuerpo)
        : this.datos.actualizar(this.editandoId, { ...cuerpo, estado: f.estado });

    peticion.subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Quiniela guardada');
        this.cerrarModal();
        this.cargar();
      },
      error: (e) => {
        this.errorFormulario = e.message;
        this.toast.error(e.message);
        this.guardando = false;
      },
    });
  }

  eliminar(q: QuinielaVista): void {
    this.pendiente = q;
  }

  confirmarEliminacion(): void {
    const q = this.pendiente;
    if (!q) return;
    this.datos.eliminar(q.id_quiniela).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Quiniela eliminada');
        this.pendiente = null;
        this.cargar();
      },
      error: (e) => {
        this.toast.error(e.message);
        this.pendiente = null;
      },
    });
  }

  abrirAportes(q: QuinielaVista): void {
    this.router.navigate(['/aportes'], { queryParams: { quiniela: q.id_quiniela } });
  }

  abrirAporte(q: QuinielaVista): void {
    this.aportandoQuiniela = q;
    this.aporteForm = { id_cliente: 0, monto: null };
    this.errorAporte = '';
    this.guardandoAporte = false;
    this.aporteVisible = true;
  }

  cerrarAporteModal(): void {
    this.aporteVisible = false;
    this.aportandoQuiniela = null;
    this.guardandoAporte = false;
  }

  get faltanteQuiniela(): string {
    const q = this.aportandoQuiniela;
    if (!q) return this.moneda(0);
    const p = this.progreso(q.id_quiniela);
    return this.moneda(p ? Math.max(0, p.faltante) : 0);
  }

  guardarAporte(): void {
    const q = this.aportandoQuiniela;
    if (!q) return;

    if (!this.aporteForm.id_cliente) {
      this.errorAporte = 'Selecciona un cliente.';
      return;
    }
    const monto = this.aporteForm.monto === null || isNaN(this.aporteForm.monto) ? 0 : this.aporteForm.monto;
    if (!(monto > 0)) {
      this.errorAporte = 'El monto es obligatorio y debe ser mayor a 0.';
      return;
    }
    const p = this.progreso(q.id_quiniela);
    if (p && monto > p.faltante) {
      this.errorAporte = `El aporte supera lo que falta por recaudar (${this.moneda(p.faltante)}).`;
      return;
    }

    this.guardandoAporte = true;
    this.errorAporte = '';
    this.aportes.crear({ id_cliente: this.aporteForm.id_cliente, id_quiniela: q.id_quiniela, monto }).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Aporte registrado correctamente');
        this.cerrarAporteModal();
        this.cargar();
      },
      error: (e) => {
        this.errorAporte = e.message;
        this.guardandoAporte = false;
      },
    });
  }
}