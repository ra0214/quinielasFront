import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Aporte, AporteDetalle, Cliente, METODOS_PAGO, Quiniela } from '../../core/domain/models';
import { formatoMoneda, formatoPorcentaje } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ConfirmDialogComponent } from '../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { ChipsFiltroComponent, OpcionChip } from '../../ui/molecules/chips-filtro/chips-filtro.component';
import { BuscadorClienteComponent } from '../../ui/molecules/buscador-cliente/buscador-cliente.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { AportesService } from './data-access/aportes.service';
import { ClientesService } from '../clientes/data-access/clientes.service';
import { QuinielasService } from '../quinielas/data-access/quinielas.service';

type VistaAportes = 'quiniela' | 'cliente';

type TipoPagoAporte = 'CONTADO' | 'PAGO_PARCIAL' | 'A_CREDITO';

interface FormAporte {
  id_cliente: number | null;
  id_quiniela: number | null;
  monto: number | null;
  tipo_pago: TipoPagoAporte;
  monto_pagado: number | null;
  metodo_pago: string;
}

/** Opciones de tipo de pago de un aporte: contado, por pagos o fiado. */
const TIPOS_PAGO: { valor: TipoPagoAporte; etiqueta: string }[] = [
  { valor: 'CONTADO', etiqueta: 'Contado' },
  { valor: 'PAGO_PARCIAL', etiqueta: 'Por pagos' },
  { valor: 'A_CREDITO', etiqueta: 'Fiado' },
];

@Component({
  selector: 'app-aportes-page',
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
    BuscadorClienteComponent,
  ],
  templateUrl: './aportes.page.html',
  styleUrl: './aportes.page.css',
})
export class AportesPage implements OnInit, OnDestroy {
  private readonly datos = inject(AportesService);
  private readonly clientesSvc = inject(ClientesService);
  private readonly quinielasSvc = inject(QuinielasService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly quinielas = signal<Quiniela[]>([]);
  readonly clientes = signal<Cliente[]>([]);
  readonly aportesQuiniela = signal<AporteDetalle[]>([]);
  readonly aportesCliente = signal<Aporte[]>([]);
  private nombres = new Map<number, string>();

  vista: VistaAportes = 'quiniela';
  readonly vistas: OpcionChip[] = [
    { valor: 'quiniela', etiqueta: 'Por quiniela', icono: 'grafica' },
    { valor: 'cliente', etiqueta: 'Por cliente', icono: 'usuario' },
  ];
  idQuinielaSel: number | null = null;
  idClienteSel: number | null = null;

  cargandoQuiniela = false;
  cargandoCliente = false;
  errorApi = '';

  readonly columnasQuiniela: ColumnaTabla[] = [
    { clave: 'nombre_cliente', etiqueta: 'Cliente' },
    { clave: 'monto_total_acumulado', etiqueta: 'Monto aportado', clase: 'num' },
    { clave: 'porcentaje_participacion', etiqueta: '% participación', clase: 'num' },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  readonly columnasCliente: ColumnaTabla[] = [
    { clave: 'id_quiniela', etiqueta: 'Quiniela', clase: 'num' },
    { clave: 'monto_total_acumulado', etiqueta: 'Monto', clase: 'num' },
    { clave: 'porcentaje_participacion', etiqueta: '% participación', clase: 'num' },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  // Modal crear/editar aporte
  readonly tiposPago = TIPOS_PAGO;
  readonly metodosPago = METODOS_PAGO;
  modalVisible = false;
  editando: Aporte | null = null;
  form: FormAporte = this.formVacio();
  guardando = false;
  errorFormulario = '';
  recaudadoQuinielaForm = 0;

  // Eliminar aporte
  pendiente: Aporte | null = null;

  private subRoute?: Subscription;

  ngOnInit(): void {
    this.quinielasSvc.listar().subscribe({
      next: (lista) => this.quinielas.set(lista),
      error: (e) => {
        this.errorApi = e.message;
      },
    });

    this.clientesSvc.listar().subscribe({
      next: (lista) => {
        this.clientes.set(lista);
        this.nombres = new Map(lista.map((c: Cliente) => [c.id_cliente, c.nombre]));
      },
      error: (e) => {
        this.errorApi = e.message;
      },
    });

    // llega ?quiniela=id desde el catálogo de quinielas
    this.subRoute = this.route.queryParams.subscribe((params) => {
      const id = Number(params['quiniela']);
      if (Number.isFinite(id) && id > 0) {
        this.idQuinielaSel = id;
        this.vista = 'quiniela';
        this.cargarAportesQuiniela();
      }
    });
  }

  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
  }

  // ===== Vistas =====
  cambiarVista(v: string): void {
    const nueva = v as VistaAportes;
    if (this.vista === nueva) return;
    this.vista = nueva;
    this.errorApi = '';
    if (nueva === 'quiniela' && this.idQuinielaSel) this.cargarAportesQuiniela();
    if (nueva === 'cliente' && this.idClienteSel) this.cargarAportesCliente();
  }

  // ===== Cargas =====
  cargarAportesQuiniela(): void {
    if (!this.idQuinielaSel) {
      this.aportesQuiniela.set([]);
      return;
    }
    this.cargandoQuiniela = true;
    this.errorApi = '';
    this.datos.porQuiniela(this.idQuinielaSel).subscribe({
      next: (lista) => {
        this.aportesQuiniela.set(lista);
        this.cargandoQuiniela = false;
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargandoQuiniela = false;
      },
    });
  }

  cargarAportesCliente(): void {
    if (!this.idClienteSel) {
      this.aportesCliente.set([]);
      return;
    }
    this.cargandoCliente = true;
    this.errorApi = '';
    this.datos.porCliente(this.idClienteSel).subscribe({
      next: (lista) => {
        this.aportesCliente.set(lista);
        this.cargandoCliente = false;
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargandoCliente = false;
      },
    });
  }

  /** Filtro por cliente de la vista "Por cliente". */
  onClienteFiltro(id: number | null): void {
    this.idClienteSel = id;
    this.cargarAportesCliente();
  }

  private recargarVista(): void {
    if (this.vista === 'quiniela') this.cargarAportesQuiniela();
    else this.cargarAportesCliente();
  }

  // ===== Selección =====
  get quinielaSel(): Quiniela | undefined {
    return this.quinielas().find((q) => q.id_quiniela === this.idQuinielaSel);
  }

  // ===== Resumen por quiniela =====
  get totalRecaudado(): number {
    return this.aportesQuiniela().reduce((suma, a) => suma + a.monto_total_acumulado, 0);
  }

  get meta(): number {
    return this.quinielaSel?.monto_meta ?? 0;
  }

  get faltante(): number {
    return Math.max(0, this.meta - this.totalRecaudado);
  }

  get avance(): number {
    return this.meta > 0 ? (this.totalRecaudado / this.meta) * 100 : 0;
  }

  /** Ancho de la barra de avance (tope 100%). */
  get avanceBarra(): number {
    return Math.min(100, Math.max(0, this.avance));
  }

  // ===== Formateo =====
  moneda(v: number): string {
    return formatoMoneda(v);
  }

  porcentaje(v: number): string {
    return formatoPorcentaje(v);
  }

  nombreDe(a: Aporte): string {
    const detalle = a as AporteDetalle;
    if (detalle.nombre_cliente) return detalle.nombre_cliente;
    return this.nombres.get(a.id_cliente) ?? `Cliente #${a.id_cliente}`;
  }

  nombreQuinielaLabel(a: Aporte): string {
    const q = this.quinielas().find((x) => x.id_quiniela === a.id_quiniela);
    return q ? `${q.nombre_variante} · #${q.id_quiniela} · Edición ${q.id_edicion}` : `Quiniela #${a.id_quiniela}`;
  }

  // ===== Crear / editar aporte =====
  private formVacio(): FormAporte {
    return { id_cliente: null, id_quiniela: null, monto: null, tipo_pago: 'CONTADO', monto_pagado: null, metodo_pago: METODOS_PAGO[0] };
  }

  /** Cuánto del aporte queda pendiente (fiado) según el tipo de pago elegido. */
  get pendienteForm(): number {
    const monto = this.form.monto ?? 0;
    if (this.form.tipo_pago === 'A_CREDITO') return monto;
    if (this.form.tipo_pago === 'PAGO_PARCIAL') return Math.max(0, monto - (this.form.monto_pagado ?? 0));
    return 0;
  }

  nuevo(): void {
    this.editando = null;
    this.form = {
      ...this.formVacio(),
      id_cliente: this.vista === 'cliente' ? this.idClienteSel : null,
      id_quiniela: this.vista === 'quiniela' ? this.idQuinielaSel : null,
    };
    this.recaudadoQuinielaForm = this.vista === 'quiniela' && this.idQuinielaSel ? this.totalRecaudado : 0;
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  editar(a: Aporte): void {
    this.editando = a;
    this.form = {
      ...this.formVacio(),
      id_cliente: a.id_cliente,
      id_quiniela: a.id_quiniela,
      monto: a.monto_total_acumulado,
    };
    // Recaudado actual de la quiniela (incluye este aporte): la barra de meta
    // y el límite se calculan descontando el aporte en edición.
    this.datos.porQuiniela(a.id_quiniela).subscribe({
      next: (lista) => {
        this.recaudadoQuinielaForm = lista.reduce((suma, x) => suma + x.monto_total_acumulado, 0);
      },
      error: () => (this.recaudadoQuinielaForm = 0),
    });
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.guardando = false;
    this.editando = null;
  }

  onQuinielaFormChange(): void {
    const id = this.form.id_quiniela;
    if (id == null) {
      this.recaudadoQuinielaForm = 0;
      return;
    }
    this.datos.porQuiniela(id).subscribe({
      next: (lista) => {
        this.recaudadoQuinielaForm = lista.reduce((suma, a) => suma + a.monto_total_acumulado, 0);
      },
      error: () => (this.recaudadoQuinielaForm = 0),
    });
  }

  get metaQuinielaForm(): number {
    const q = this.quinielas().find((x) => x.id_quiniela === this.form.id_quiniela);
    return q?.monto_meta ?? 0;
  }

  get maxMonto(): number {
    const q = this.quinielas().find((x) => x.id_quiniela === this.form.id_quiniela);
    if (!q) return 0;
    let recaudado = this.recaudadoQuinielaForm;
    if (this.editando) recaudado = recaudado - (this.editando.monto_total_acumulado || 0);
    return Math.max(0, q.monto_meta - recaudado);
  }

  get hayMontoDisponible(): boolean {
    return this.maxMonto > 0;
  }

  guardar(): void {
    if (!this.form.id_cliente || !this.form.id_quiniela) {
      this.errorFormulario = 'Debes seleccionar un cliente y una quiniela.';
      return;
    }
    const monto = this.form.monto === null || isNaN(this.form.monto) ? NaN : this.form.monto;
    if (isNaN(monto) || monto <= 0) {
      this.errorFormulario = 'El monto debe ser un número mayor a 0.';
      return;
    }
    if (monto > this.maxMonto) {
      this.errorFormulario = `El monto excede lo solicitado: solo faltan ${formatoMoneda(this.maxMonto)} por recaudar.`;
      return;
    }

    if (monto > this.maxMonto) {
      this.errorFormulario = `El monto excede lo solicitado: solo faltan ${formatoMoneda(this.maxMonto)} por recaudar.`;
      return;
    }

    let montoPagado = monto;
    if (this.form.tipo_pago === 'A_CREDITO') {
      montoPagado = 0;
    } else if (this.form.tipo_pago === 'PAGO_PARCIAL') {
      const pagado = this.form.monto_pagado;
      if (pagado === null || isNaN(pagado) || pagado < 0) {
        this.errorFormulario = 'Indica cuánto del aporte se pagó.';
        return;
      }
      if (pagado > monto) {
        this.errorFormulario = `Lo pagado no puede superar el monto aportado (${formatoMoneda(monto)}).`;
        return;
      }
      montoPagado = pagado;
    }

    this.guardando = true;
    this.errorFormulario = '';

    const peticion = this.editando
      ? this.datos.actualizar(this.editando.id_aporte, monto)
      : this.datos.crear({
          id_cliente: this.form.id_cliente,
          id_quiniela: this.form.id_quiniela,
          monto,
          monto_pagado: montoPagado,
          metodo_pago: this.form.metodo_pago,
        });

    peticion.subscribe({
      next: (res) => {
        this.toast.exito(res.message || (this.editando ? 'Aporte actualizado correctamente' : 'Aporte registrado correctamente'));
        this.cerrarModal();
        this.recargarVista();
      },
      error: (e) => {
        this.errorFormulario = e.message;
        this.guardando = false;
        this.toast.error(e.message);
      },
    });
  }

  // ===== Eliminar aporte =====
  eliminar(a: Aporte): void {
    this.pendiente = a;
  }

  mensajeEliminacion(): string {
    const a = this.pendiente;
    if (!a) return '';
    return `¿Seguro que deseas eliminar el aporte de ${this.nombreDe(a)} a la quiniela #${a.id_quiniela}? Esta acción no se puede deshacer.`;
  }

  confirmarEliminacion(): void {
    const a = this.pendiente;
    if (!a) return;
    this.datos.eliminar(a.id_aporte).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Aporte eliminado');
        this.pendiente = null;
        this.recargarVista();
      },
      error: (e) => {
        this.toast.error(e.message);
        this.pendiente = null;
      },
    });
  }
}
