import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { etiquetaQuiniela as construirEtiquetaQuiniela, formatoMoneda } from '../../core/domain/helpers';
import {
  Cliente,
  Edicion,
  Movimiento,
  MovimientoRequest,
  Quiniela,
  TipoMovimiento,
} from '../../core/domain/models';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ChipsFiltroComponent, OpcionChip } from '../../ui/molecules/chips-filtro/chips-filtro.component';
import { BuscadorClienteComponent } from '../../ui/molecules/buscador-cliente/buscador-cliente.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { ClientesService } from '../clientes/data-access/clientes.service';
import { QuinielasService } from '../quinielas/data-access/quinielas.service';
import { EdicionesService } from '../ediciones/data-access/ediciones.service';
import { SaldosService } from '../saldos/data-access/saldos.service';
import { MovimientosService } from './data-access/movimientos.service';

/** Movimiento enriquecido con el nombre del cliente para mostrar y ordenar la tabla. */
interface MovimientoVista extends Movimiento {
  nombre_cliente: string;
}

@Component({
  selector: 'app-movimientos',
  standalone: true,
  imports: [
    IconoComponent,
    FormsModule,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    ChipsFiltroComponent,
    BadgeComponent,
    TablaComponent,
    CeldaDirective,
    ModalComponent,
    BuscadorClienteComponent,
  ],
  templateUrl: './movimientos.page.html',
  styleUrl: './movimientos.page.css',
})
export class MovimientosPage implements OnInit, OnDestroy {
  private readonly datos = inject(MovimientosService);
  private readonly clientesDatos = inject(ClientesService);
  private readonly quinielasDatos = inject(QuinielasService);
  private readonly edicionesDatos = inject(EdicionesService);
  private readonly saldosDatos = inject(SaldosService);
  private readonly toast = inject(ToastService);
  private readonly ruta = inject(ActivatedRoute);

  readonly tipos: TipoMovimiento[] = [
    'PAGO_EFECTIVO',
    'PAGO_SALDO',
    'FIADO',
    'RETIRO',
    'PREMIO_ABONO',
    'DEVOLUCION',
  ];

  readonly chips: OpcionChip[] = [
    { etiqueta: 'Todos', valor: '' },
    ...this.tipos.map((t) => ({ etiqueta: t, valor: t })),
  ];

  readonly movimientos = signal<Movimiento[]>([]);
  readonly clientes = signal<Cliente[]>([]);
  readonly quinielas = signal<Quiniela[]>([]);
  readonly ediciones = signal<Edicion[]>([]);
  readonly saldosPorCliente = new Map<number, number>();

  cargando = false;
  errorApi = '';

  // Filtros
  clienteSeleccionado: number | '' = '';
  filtroTipo = '';

  readonly columnas: ColumnaTabla[] = [
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'nombre_cliente', etiqueta: 'Cliente' },
    { clave: 'tipo', etiqueta: 'Tipo' },
    { clave: 'monto', etiqueta: 'Monto' },
    { clave: 'descripcion', etiqueta: 'Detalle' },
  ];

  // Modal crear
  modalVisible = false;
  formulario: MovimientoRequest = { id_cliente: 0, id_quiniela: null, tipo: '', monto: 0, descripcion: '' };
  guardando = false;
  errorFormulario = '';

  private sub?: Subscription;

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarQuinielas();
    this.cargarEdiciones();
    this.cargarSaldos();
    // /pagos y /retiros llegan con un filtro fijo por tipo.
    this.filtroTipo = (this.ruta.snapshot.data['filtro'] as string) ?? '';
    // llega desde Clientes con ?cliente=id
    this.sub = this.ruta.queryParams.subscribe((params) => {
      const id = Number(params['cliente']);
      this.clienteSeleccionado = Number.isInteger(id) && id > 0 ? id : '';
      this.cargarMovimientos();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get mapaClientes(): Record<number, string> {
    const mapa: Record<number, string> = {};
    for (const c of this.clientes()) mapa[c.id_cliente] = c.nombre;
    return mapa;
  }

  get lista(): MovimientoVista[] {
    const base = this.movimientos().map((m) => ({
      ...m,
      nombre_cliente: this.mapaClientes[m.id_cliente] ?? `Cliente #${m.id_cliente}`,
    }));
    if (!this.filtroTipo) return base;
    const tipos = this.filtroTipo.split(',');
    return base.filter((m) => tipos.includes(m.tipo));
  }

  get totalMovimientos(): string {
    return String(this.lista.length);
  }

  get montoTotal(): string {
    if (this.clienteSeleccionado === '') return '—';
    return formatoMoneda(this.lista.reduce((suma, m) => suma + (m.monto || 0), 0));
  }

  get mensajeVacio(): string {
    if (this.filtroTipo) return 'No hay movimientos de este tipo';
    if (this.clienteSeleccionado !== '') return 'Este cliente aún no tiene movimientos';
    return 'Aún no hay movimientos registrados';
  }

  cargarClientes(): void {
    this.clientesDatos.listar().subscribe({
      next: (lista) => this.clientes.set(lista),
      error: (e) => this.toast.error(e.message),
    });
  }

  cargarQuinielas(): void {
    this.quinielasDatos.listar().subscribe({
      next: (lista) => this.quinielas.set(lista),
      error: (e) => this.toast.error(e.message),
    });
  }

  cargarEdiciones(): void {
    this.edicionesDatos.listar().subscribe({
      next: (lista) => this.ediciones.set(lista),
      error: (e) => this.toast.error(e.message),
    });
  }

  /** Etiqueta "Analista - Tipo de edición - Número" de una quiniela. */
  etiquetaQuiniela(q: Quiniela): string {
    const tipo = this.ediciones().find((e) => e.id_edicion === q.id_edicion)?.tipo_edicion;
    const numero = this.ediciones().find((e) => e.id_edicion === q.id_edicion)?.nombre_edicion;
    return construirEtiquetaQuiniela(q.nombre_variante, tipo, numero, q.id_quiniela);
  }

  cargarSaldos(): void {
    this.saldosDatos.listar().subscribe({
      next: (lista) => {
        this.saldosPorCliente.clear();
        for (const s of lista) this.saldosPorCliente.set(s.id_cliente, s.saldo_favor);
      },
      error: (e) => this.toast.error(e.message),
    });
  }

  cargarMovimientos(): void {
    this.cargando = true;
    this.errorApi = '';
    const peticion =
      this.clienteSeleccionado === ''
        ? this.datos.listar()
        : this.datos.porCliente(this.clienteSeleccionado);
    peticion.subscribe({
      next: (lista) => {
        this.movimientos.set(lista);
        this.cargando = false;
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargando = false;
      },
    });
  }

  onClienteCambio(valor: number | null): void {
    this.clienteSeleccionado = valor ?? '';
    this.cargarMovimientos();
  }

  nuevo(): void {
    this.formulario = {
      id_cliente: this.clienteSeleccionado === '' ? 0 : this.clienteSeleccionado,
      id_quiniela: null,
      tipo: '',
      monto: 0,
      descripcion: '',
    };
    this.errorFormulario = '';
    this.guardando = false;
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.guardando = false;
  }

  get saldoFavorActual(): string {
    return formatoMoneda(this.saldosPorCliente.get(this.formulario.id_cliente) ?? 0);
  }

  guardar(): void {
    const f = this.formulario;
    if (!f.id_cliente) {
      this.errorFormulario = 'Selecciona un cliente.';
      return;
    }
    if (!f.tipo) {
      this.errorFormulario = 'Selecciona el tipo de movimiento.';
      return;
    }
    if (!(f.monto > 0)) {
      this.errorFormulario = 'El monto es obligatorio y debe ser mayor a 0.';
      return;
    }
    if (f.tipo === 'RETIRO' || f.tipo === 'PAGO_SALDO') {
      const favor = this.saldosPorCliente.get(f.id_cliente) ?? 0;
      if (f.monto > favor) {
        this.errorFormulario = 'El cliente no tiene saldo a favor suficiente para este movimiento.';
        return;
      }
    }
    if (!f.descripcion.trim()) {
      this.errorFormulario = 'La descripción es obligatoria.';
      return;
    }

    this.guardando = true;
    this.errorFormulario = '';
    const cuerpo: MovimientoRequest = {
      id_cliente: f.id_cliente,
      id_quiniela: f.id_quiniela ?? null,
      tipo: f.tipo,
      monto: f.monto,
      descripcion: f.descripcion.trim(),
    };

    this.datos.crear(cuerpo).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Movimiento registrado');
        this.cerrarModal();
        this.cargarMovimientos();
      },
      error: (e) => {
        this.errorFormulario = e.message;
        this.guardando = false;
      },
    });
  }
}
