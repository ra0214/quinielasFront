import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AporteDetalle, CanalVenta, Cliente, Edicion, EstadoQuiniela, METODOS_PAGO, Quiniela, QuinielaRequest, TipoPagoQuiniela, TipoQuiniela } from '../../core/domain/models';
import { aRfc3339, deRfc3339AInput, formatoMoneda } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ChipsFiltroComponent, OpcionChip } from '../../ui/molecules/chips-filtro/chips-filtro.component';
import { BuscadorClienteComponent } from '../../ui/molecules/buscador-cliente/buscador-cliente.component';
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
  monto_meta: number | null; // costo total de la quiniela (monto a cobrar)
  fecha_limite: string; // valor de input datetime-local
  estado: string;
  tipo_quiniela: TipoQuiniela;
  id_cliente: number; // 0 = sin seleccionar
  tipo_pago: TipoPagoQuiniela;
  monto_pagado: number | null; // pago de apertura / parcial (solo DIRECTA)
  primerAporte: number | null; // aporte inicial del creador (solo DESARROLLO, al crear)
  canal_venta: CanalVenta;
  sujeto_cancelacion: boolean; // solo DESARROLLO
  punto_retorno: boolean; // solo al aumentar la meta de una quiniela con aportes
  metodo_pago: string; // método del primer aporte (efectivo, tarjeta, etc.)
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
    BadgeComponent,
    BuscadorClienteComponent,
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
    { valor: 'DESARROLLO', etiqueta: 'Desarrollo' },
  ];
  readonly tiposPago: { valor: TipoPagoQuiniela; etiqueta: string }[] = [
    { valor: 'CONTADO', etiqueta: 'Pagado (contado)' },
    { valor: 'PAGO_PARCIAL', etiqueta: 'Pago parcial' },
    { valor: 'A_CREDITO', etiqueta: 'A crédito (pendiente)' },
  ];
  readonly canalesVenta: { valor: CanalVenta; etiqueta: string }[] = [
    { valor: 'EN_LINEA', etiqueta: 'En línea' },
    { valor: 'VENTANILLA', etiqueta: 'Ventanilla' },
  ];
  readonly metodosPago = METODOS_PAGO;

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
    { clave: 'canal_venta', etiqueta: 'Canal', ordenable: false },
    { clave: 'pago', etiqueta: 'Estado de pago', ordenable: false },
    { clave: 'monto_meta', etiqueta: 'Costo total', tipo: 'moneda', clase: 'num' },
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
  /** Meta original de la quiniela en edición (para detectar aumentos). */
  metaOriginal: number | null = null;
  /** Se oculta la alerta de completado hasta el siguiente refresco. */
  alertaCerrada = false;

  // Modal registrar aporte (misma ventana)
  aporteVisible = false;

  aportandoQuiniela: QuinielaVista | null = null;
  aporteForm: {
    id_cliente: number;
    monto: number | null;
    tipo_pago: TipoPagoQuiniela;
    monto_pagado: number | null;
    metodo_pago: string;
  } = { id_cliente: 0, monto: null, tipo_pago: 'CONTADO', monto_pagado: null, metodo_pago: METODOS_PAGO[0] };
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
      monto_meta: null,
      fecha_limite: '',
      estado: 'EN_JUEGO',
      tipo_quiniela: 'DIRECTA',
      id_cliente: primerCliente,
      tipo_pago: 'CONTADO',
      monto_pagado: null,
      primerAporte: null,
      canal_venta: 'EN_LINEA',
      sujeto_cancelacion: true,
      punto_retorno: false,
      metodo_pago: METODOS_PAGO[0],
    };
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    this.alertaCerrada = false;
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

    // DIRECTA (y cualquier tipo que no se fondee por aportes): el avance es el
    // pago directo registrado en la propia quiniela. DESARROLLO usa aportes.
    const mapa: Record<number, ProgresoQuiniela> = {};
    const desarrollo: Quiniela[] = [];
    for (const q of lista) {
      if (q.tipo_quiniela === 'DESARROLLO') {
        desarrollo.push(q);
      } else {
        mapa[q.id_quiniela] = this.calcularProgreso(q.monto_meta, q.monto_pagado || 0);
      }
    }
    this.progresos.set(mapa);

    if (desarrollo.length === 0) {
      return;
    }

    const peticiones = desarrollo.map((q) =>
      this.aportes.porQuiniela(q.id_quiniela).pipe(
        catchError(() => of<AporteDetalle[] | null>(null)),
        map((aportes) => {
          if (!aportes) return null;
          const recaudado = aportes.reduce((suma, a) => suma + (a.monto_total_acumulado || 0), 0);
          return { id: q.id_quiniela, progreso: this.calcularProgreso(q.monto_meta, recaudado) };
        })
      )
    );
    forkJoin(peticiones).subscribe({
      next: (entradas) => {
        const actual = { ...this.progresos() };
        for (const entrada of entradas) {
          if (entrada) actual[entrada.id] = entrada.progreso;
        }
        this.progresos.set(actual);
      },
      error: () => undefined,
    });
  }

  private calcularProgreso(meta: number | undefined, recaudado: number): ProgresoQuiniela {
    const total = meta || 0;
    return {
      recaudado,
      faltante: Math.max(total - recaudado, 0),
      porcentaje: total > 0 ? (recaudado / total) * 100 : 0,
    };
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

  /** Al subir la meta de una quiniela con aportes hay que indicar el punto de retorno. */
  get requierePuntoRetorno(): boolean {
    const f = this.formulario;
    if (this.editandoId === null) return false;
    if (f.tipo_quiniela !== 'DESARROLLO') return false;
    if (this.metaOriginal === null || (f.monto_meta ?? 0) <= this.metaOriginal) return false;
    const recaudado = this.progreso(this.editandoId)?.recaudado ?? 0;
    return recaudado > 0;
  }

  /** Quinielas DESARROLLO en juego que ya alcanzaron la meta (requieren decisión). */
  get completadasPendientes(): QuinielaVista[] {
    return this.quinielas().filter((q) => {
      if (q.tipo_quiniela !== 'DESARROLLO' || q.estado !== 'EN_JUEGO') return false;
      const recaudado = this.progreso(q.id_quiniela)?.recaudado ?? 0;
      return recaudado > 0 && recaudado >= (q.monto_meta || 0);
    });
  }

  get alertaCompletada(): QuinielaVista | null {
    if (this.alertaCerrada) return null;
    return this.completadasPendientes[0] ?? null;
  }

  cerrarAlerta(): void {
    this.alertaCerrada = true;
  }

  private cuerpoDesdeQuiniela(q: QuinielaVista, estado: string): QuinielaRequest {
    return {
      id_edicion: q.id_edicion,
      nombre_variante: q.nombre_variante,
      monto_meta: q.monto_meta,
      fecha_limite: q.fecha_limite,
      estado,
      tipo_quiniela: q.tipo_quiniela,
      id_cliente: q.id_cliente ?? null,
      monto_pagado: q.monto_pagado ?? 0,
      analista: q.analista,
      tipo_pago: q.tipo_pago,
      canal_venta: q.canal_venta,
      sujeto_cancelacion: q.sujeto_cancelacion,
    };
  }

  marcarCompletada(q: QuinielaVista): void {
    this.datos.actualizar(q.id_quiniela, this.cuerpoDesdeQuiniela(q, 'COMPLETADA')).subscribe({
      next: () => {
        this.toast.exito('Quiniela marcada como completada');
        this.alertaCerrada = true;
        this.cargar();
      },
      error: (e) => this.toast.error(e.message),
    });
  }

  editarDesdeAlerta(q: QuinielaVista): void {
    this.alertaCerrada = true;
    this.editar(q);
  }

  /** Total a cobrar al cliente: el costo total de la quiniela. */
  totalCobrar(q: Quiniela): number {
    return q.monto_meta || 0;
  }

  totalCobrarForm(f: FormularioQuiniela): number {
    return f.monto_meta ?? 0;
  }

  etiquetaTipo(valor: string): string {
    switch (valor) {
      case 'DIRECTA':
        return 'Directa';
      case 'DESARROLLO':
        return 'Desarrollo';
      default:
        return valor || '—';
    }
  }

  etiquetaCanal(valor: string | undefined): string {
    return valor === 'VENTANILLA' ? 'Ventanilla' : 'En línea';
  }

  /** Estado de pago mostrado en la tabla. */
  estadoPago(q: Quiniela): { texto: string; clase: string } {
    const total = this.totalCobrar(q);
    if (total === 0) {
      return { texto: '—', clase: 'saldo-cero' };
    }
    // DESARROLLO: el avance se mide por la recaudación de aportes.
    if (q.tipo_quiniela === 'DESARROLLO') {
      const recaudado = this.progreso(q.id_quiniela)?.recaudado ?? 0;
      if (recaudado <= 0) {
        return { texto: 'Sin aportes', clase: 'texto-rojo' };
      }
      if (recaudado >= total) {
        return { texto: 'Completada', clase: 'texto-verde' };
      }
      return { texto: `Recaudado ${this.moneda(recaudado)}/${this.moneda(total)}`, clase: 'texto-amarillo' };
    }
    const pagado = q.monto_pagado || 0;
    if (!q.id_cliente) {
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
    if (f.tipo_pago === 'CONTADO') {
      // DIRECTA cobra el total; DESARROLLO paga completo el primer aporte.
      f.monto_pagado = f.tipo_quiniela === 'DESARROLLO' ? f.primerAporte ?? 0 : this.totalCobrarForm(f);
    } else if (f.tipo_pago === 'A_CREDITO') {
      f.monto_pagado = 0;
    }
  }

  /** Al cambiar el tipo: en DESARROLLO el primer aporte se precarga con el total. */
  alCambiarTipo(): void {
    this.precargarPrimerAporte();
    this.refrescarMontoPagado();
  }

  /** Al cambiar el costo total se sincroniza el primer aporte si aún está vacío. */
  alCambiarMeta(): void {
    this.precargarPrimerAporte();
  }

  private precargarPrimerAporte(): void {
    const f = this.formulario;
    if (this.editandoId === null && f.tipo_quiniela === 'DESARROLLO' && (f.primerAporte == null || f.primerAporte === 0)) {
      f.primerAporte = f.monto_meta;
      this.refrescarMontoPagado();
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
    this.metaOriginal = q.monto_meta;
    this.formulario = {
      id_edicion: q.id_edicion,
      nombre_variante: q.nombre_variante,
      monto_meta: q.monto_meta,
      fecha_limite: deRfc3339AInput(q.fecha_limite),
      estado: q.estado,
      tipo_quiniela: (q.tipo_quiniela as TipoQuiniela) || 'DIRECTA',
      id_cliente: q.id_cliente ?? 0,
      tipo_pago: (q.tipo_pago as TipoPagoQuiniela) || 'A_CREDITO',
      monto_pagado: q.monto_pagado ?? null,
      primerAporte: null,
      canal_venta: (q.canal_venta as CanalVenta) || 'EN_LINEA',
      sujeto_cancelacion: q.sujeto_cancelacion ?? true,
      punto_retorno: false,
      metodo_pago: METODOS_PAGO[0],
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
    if (f.monto_meta == null || f.monto_meta <= 0) {
      this.errorFormulario = 'El costo total de la quiniela es obligatorio y debe ser mayor a 0.';
      return;
    }
    const total = this.totalCobrarForm(f);
    if (!f.id_cliente) {
      this.errorFormulario = 'Selecciona el cliente que paga la quiniela.';
      return;
    }
    const esDesarrollo = f.tipo_quiniela === 'DESARROLLO';
    let montoPagado = 0;
    let primerAporte = 0;
    let pagoAporte = 0;
    if (esDesarrollo) {
      // DESARROLLO se fondea con aportes: el del creador es el movimiento
      // inicial. El método de pago define cuánto de ese aporte queda pagado.
      // Si no se indica, el primer aporte es el costo total.
      primerAporte = f.primerAporte ?? total;
      if (primerAporte < 0 || primerAporte > total) {
        this.errorFormulario = 'El primer aporte debe estar entre 0 y el costo total de la quiniela.';
        return;
      }
      if (f.tipo_pago === 'CONTADO') {
        pagoAporte = primerAporte;
      } else if (f.tipo_pago === 'PAGO_PARCIAL') {
        if (f.monto_pagado == null || f.monto_pagado <= 0) {
          this.errorFormulario = 'Indica el monto pagado del primer aporte.';
          return;
        }
        if (f.monto_pagado > primerAporte) {
          this.errorFormulario = 'El monto pagado no puede superar el primer aporte.';
          return;
        }
        pagoAporte = f.monto_pagado;
      }
      // A crédito: pagoAporte queda en 0 y el aporte entero se fía.
    } else if (f.tipo_pago === 'CONTADO') {
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
    if (!f.fecha_limite) {
      this.errorFormulario = 'La fecha y hora límite es obligatoria.';
      return;
    }
    if (this.editandoId !== null && !f.estado) {
      this.errorFormulario = 'Selecciona el estado de la quiniela.';
      return;
    }
    // Un mismo analista (variante) no puede repetirse dentro del mismo número
    // (edición); además, cada número admite como máximo 5 quinielas.
    const deEstaEdicion = this.quinielas().filter(
      (q) => q.id_edicion === f.id_edicion && q.id_quiniela !== this.editandoId
    );
    if (deEstaEdicion.length >= 5) {
      this.errorFormulario = 'Cada número admite como máximo 5 quinielas.';
      return;
    }
    if (deEstaEdicion.some((q) => q.nombre_variante === f.nombre_variante)) {
      this.errorFormulario = `El analista ${f.nombre_variante} ya tiene una quiniela en este número.`;
      return;
    }

    const cuerpo: QuinielaRequest = {
      id_edicion: f.id_edicion,
      nombre_variante: f.nombre_variante,
      monto_meta: f.monto_meta ?? 0,
      fecha_limite: aRfc3339(f.fecha_limite),
      tipo_quiniela: f.tipo_quiniela,
      id_cliente: f.id_cliente,
      monto_pagado: montoPagado,
      analista: f.nombre_variante,
      tipo_pago: esDesarrollo ? 'A_CREDITO' : f.tipo_pago,
      canal_venta: f.canal_venta,
      sujeto_cancelacion: f.sujeto_cancelacion,
    };
    // Al subir la meta de una quiniela con aportes hay que indicar el punto de retorno.
    if (this.requierePuntoRetorno) {
      cuerpo.punto_retorno = f.punto_retorno;
    }
    this.guardando = true;
    this.errorFormulario = '';

    // POST sin estado: la quiniela nace EN_JUEGO.
    const peticion =
      this.editandoId === null
        ? this.datos.crear(cuerpo)
        : this.datos.actualizar(this.editandoId, { ...cuerpo, estado: f.estado });

    peticion.subscribe({
      next: (res) => {
        const creada = (res as { quiniela?: Quiniela }).quiniela;
        // En DESARROLLO el creador registra su aporte inicial (suma a la recaudación).
        if (primerAporte > 0 && creada) {
          this.aportes
            .crear({ id_cliente: f.id_cliente, id_quiniela: creada.id_quiniela, monto: primerAporte, monto_pagado: pagoAporte, metodo_pago: f.metodo_pago })
            .subscribe({
              next: () => {
                this.toast.exito('Quiniela creada con su aporte inicial');
                this.cerrarModal();
                this.cargar();
              },
              error: (e) => {
                this.errorFormulario = `La quiniela se creó, pero el aporte inicial falló: ${e.message}`;
                this.toast.error('La quiniela se creó, pero el aporte inicial falló.');
              },
            });
          return;
        }
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

  abrirAportes(q: QuinielaVista): void {
    this.router.navigate(['/aportes'], { queryParams: { quiniela: q.id_quiniela } });
  }

  abrirAporte(q: QuinielaVista): void {
    this.aportandoQuiniela = q;
    this.aporteForm = { id_cliente: 0, monto: null, tipo_pago: 'CONTADO', monto_pagado: null, metodo_pago: METODOS_PAGO[0] };
    this.errorAporte = '';
    this.guardandoAporte = false;
    this.aporteVisible = true;
  }

  /** Cuánto del aporte rápido queda fiado al cliente. */
  get pendienteAporte(): number {
    const monto = this.aporteForm.monto ?? 0;
    if (this.aporteForm.tipo_pago === 'A_CREDITO') return monto;
    if (this.aporteForm.tipo_pago === 'PAGO_PARCIAL') return Math.max(0, monto - (this.aporteForm.monto_pagado ?? 0));
    return 0;
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

    // Tipo de pago: contado (todo pagado), por pagos (parcial) o fiado (0 pagado).
    let montoPagado = monto;
    if (this.aporteForm.tipo_pago === 'A_CREDITO') {
      montoPagado = 0;
    } else if (this.aporteForm.tipo_pago === 'PAGO_PARCIAL') {
      const pagado = this.aporteForm.monto_pagado;
      if (pagado == null || isNaN(pagado) || pagado < 0) {
        this.errorAporte = 'Indica cuánto se pagó del aporte.';
        return;
      }
      if (pagado > monto) {
        this.errorAporte = `Lo pagado no puede superar el monto del aporte (${this.moneda(monto)}).`;
        return;
      }
      montoPagado = pagado;
    }

    this.guardandoAporte = true;
    this.errorAporte = '';
    this.aportes
      .crear({
        id_cliente: this.aporteForm.id_cliente,
        id_quiniela: q.id_quiniela,
        monto,
        monto_pagado: montoPagado,
        metodo_pago: this.aporteForm.metodo_pago,
      })
      .subscribe({
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