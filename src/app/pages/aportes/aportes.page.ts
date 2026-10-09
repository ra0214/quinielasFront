import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Aporte, AporteDetalle, Cliente, Quiniela } from '../../core/domain/models';
import { formatoMoneda, formatoPorcentaje } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ConfirmDialogComponent } from '../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { ChipsFiltroComponent, OpcionChip } from '../../ui/molecules/chips-filtro/chips-filtro.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { AportesService } from './data-access/aportes.service';
import { ClientesService } from '../clientes/data-access/clientes.service';
import { QuinielasService } from '../quinielas/data-access/quinielas.service';

type VistaAportes = 'quiniela' | 'cliente';

interface FormAporte {
  id_cliente: number | null;
  id_quiniela: number | null;
  monto: number | null;
}

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

  // Modal crear aporte
  modalVisible = false;
  form: FormAporte = { id_cliente: null, id_quiniela: null, monto: null };
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

  // ===== Crear aporte =====
  nuevo(): void {
    this.form = {
      id_cliente: this.vista === 'cliente' ? this.idClienteSel : null,
      id_quiniela: this.vista === 'quiniela' ? this.idQuinielaSel : null,
      monto: null,
    };
    this.recaudadoQuinielaForm = this.vista === 'quiniela' && this.idQuinielaSel ? this.totalRecaudado : 0;
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.guardando = false;
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

  get maxMonto(): number {
    const q = this.quinielas().find((x) => x.id_quiniela === this.form.id_quiniela);
    if (!q) return 0;
    return Math.max(0, q.monto_meta - this.recaudadoQuinielaForm);
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

    this.guardando = true;
    this.errorFormulario = '';

    this.datos
      .crear({
        id_cliente: this.form.id_cliente,
        id_quiniela: this.form.id_quiniela,
        monto,
      })
      .subscribe({
        next: (res) => {
          this.toast.exito(res.message || 'Aporte registrado correctamente');
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
