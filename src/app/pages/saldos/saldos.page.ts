import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cliente, Saldo } from '../../core/domain/models';
import { formatoMoneda } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { BuscadorComponent } from '../../ui/molecules/buscador/buscador.component';
import { ChipsFiltroComponent, OpcionChip } from '../../ui/molecules/chips-filtro/chips-filtro.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { ClientesService } from '../clientes/data-access/clientes.service';
import { MovimientosService } from '../movimientos/data-access/movimientos.service';
import { FiltroSaldo, SaldosService } from './data-access/saldos.service';

/** Fila de presentación del dashboard de saldos. */
interface FilaSaldo {
  id_cliente: number;
  nombre: string;
  saldo_favor: number;
  saldo_deuda: number;
  neto: number;
}

type TipoFiltro = 'todos' | FiltroSaldo;

/** Modo del modal: captura de pago o captura de retiro. */
type ModoModal = 'pago' | 'retiro';

/** Métodos de pago disponibles al registrar un pago. */
const METODOS_PAGO = ['En efectivo', 'Por tarjeta', 'Por transferencia', 'Por depósito'] as const;

@Component({
  selector: 'app-saldos-page',
  standalone: true,
  imports: [
    IconoComponent,
    FormsModule,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    ChipsFiltroComponent,
    BuscadorComponent,
    TablaComponent,
    CeldaDirective,
    ModalComponent,
    BadgeComponent,
  ],
  templateUrl: './saldos.page.html',
  styleUrl: './saldos.page.css',
})
export class SaldosPage implements OnInit {
  private readonly datos = inject(SaldosService);
  private readonly movimientosSvc = inject(MovimientosService);
  private readonly clientesSvc = inject(ClientesService);
  private readonly toast = inject(ToastService);

  readonly filas = signal<FilaSaldo[]>([]);
  private nombres = new Map<number, string>();

  cargando = true;
  errorApi = '';

  // Filtros del servidor
  filtro: TipoFiltro = 'todos';
  readonly tiposFiltro: OpcionChip[] = [
    { valor: 'todos', etiqueta: 'Todos' },
    { valor: 'deben', etiqueta: 'Deben', claseActivo: 'activo-rojo' },
    { valor: 'favor', etiqueta: 'A favor', claseActivo: 'activo-verde' },
    { valor: 'ceros', etiqueta: 'En cero' },
  ];

  // Filtro auxiliar por nombre (client-side)
  busqueda = '';

  readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Cliente' },
    { clave: 'neto', etiqueta: 'Saldo', clase: 'num' },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  readonly metodosPago = METODOS_PAGO;

  // Modal de pago / retiro
  modalVisible = false;
  modo: ModoModal = 'pago';
  editandoId: number | null = null;
  editandoFila: FilaSaldo | null = null;
  movForm: { monto: number | null; metodoPago: string; descripcion: string } = {
    monto: null,
    metodoPago: METODOS_PAGO[0],
    descripcion: '',
  };
  guardando = false;
  errorFormulario = '';

  ngOnInit(): void {
    this.clientesSvc.listar().subscribe({
      next: (lista) => {
        this.nombres = new Map(lista.map((c: Cliente) => [c.id_cliente, c.nombre]));
        this.cargar();
      },
      error: (e) => {
        this.toast.error(e.message);
        this.cargar();
      },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    const filtro: FiltroSaldo | undefined = this.filtro === 'todos' ? undefined : this.filtro;
    this.datos.listar(filtro).subscribe({
      next: (lista) => {
        this.filas.set(lista.map((s: Saldo) => this.aFila(s)));
        this.cargando = false;
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargando = false;
      },
    });
  }

  private aFila(s: Saldo): FilaSaldo {
    return {
      id_cliente: s.id_cliente,
      nombre: this.nombres.get(s.id_cliente) ?? `Cliente #${s.id_cliente}`,
      saldo_favor: s.saldo_favor,
      saldo_deuda: s.saldo_deuda,
      neto: s.saldo_favor - s.saldo_deuda,
    };
  }

  aplicarFiltro(t: string): void {
    const valor = t as TipoFiltro;
    if (this.filtro === valor) return;
    this.filtro = valor;
    this.cargar();
  }

  /** Filas visibles: la tabla se encarga del ordenamiento interno. */
  get lista(): FilaSaldo[] {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return this.filas();
    return this.filas().filter((f) => f.nombre.toLowerCase().includes(q));
  }

  // ===== Resumen =====
  get totalDeuda(): number {
    return this.filas().reduce((suma, f) => suma + f.saldo_deuda, 0);
  }

  get totalFavor(): number {
    return this.filas().reduce((suma, f) => suma + f.saldo_favor, 0);
  }

  /** Suma del total a favor y el total de deuda. */
  get totalGeneral(): number {
    return this.totalFavor + this.totalDeuda;
  }

  get conDeuda(): number {
    return this.filas().filter((f) => f.saldo_deuda > 0).length;
  }

  get conDeudaTexto(): string {
    return String(this.conDeuda);
  }

  moneda(v: number): string {
    return formatoMoneda(v);
  }

  /** Texto del saldo neto: positivo a favor, negativo cuando está en contra. */
  saldoTexto(f: FilaSaldo): string {
    return formatoMoneda(f.neto);
  }

  /** Color del saldo: verde si es a favor, rojo si está en contra. */
  claseSaldo(f: FilaSaldo): string {
    if (f.neto > 0) return 'texto-verde';
    if (f.neto < 0) return 'texto-rojo';
    return 'saldo-cero';
  }

  /** Solo se puede retirar si el cliente tiene saldo a favor. */
  puedeRetirar(f: FilaSaldo): boolean {
    return f.neto > 0;
  }

  // ===== Pago / retiro =====
  pago(f: FilaSaldo): void {
    this.abrirMovimiento(f, 'pago');
  }

  retiro(f: FilaSaldo): void {
    if (!this.puedeRetirar(f)) return;
    this.abrirMovimiento(f, 'retiro');
  }

  private abrirMovimiento(f: FilaSaldo, modo: ModoModal): void {
    this.editandoId = f.id_cliente;
    this.editandoFila = f;
    this.modo = modo;
    this.movForm = { monto: null, metodoPago: METODOS_PAGO[0], descripcion: '' };
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.guardando = false;
    this.editandoFila = null;
  }

  get tituloModal(): string {
    const nombre = this.nombreEditando();
    if (this.modo === 'pago') return `Registrar pago · ${nombre}`;
    return `Registrar retiro · ${nombre}`;
  }

  get lenguajeModal(): string {
    if (this.modo === 'pago') return 'El pago reduce la deuda del cliente y, si sobra, se acumula a su favor.';
    return 'El retiro se cobra del saldo a favor del cliente y queda registrado como movimiento.';
  }

  nombreEditando(): string {
    if (this.editandoId === null) return '';
    return this.nombres.get(this.editandoId) ?? `Cliente #${this.editandoId}`;
  }

  get saldoFavorEditando(): string {
    return formatoMoneda(this.editandoFila?.saldo_favor ?? 0);
  }

  guardar(): void {
    const id = this.editandoId;
    if (id === null) return;

    const monto = this.movForm.monto === null || isNaN(this.movForm.monto) ? 0 : this.movForm.monto;
    if (!(monto > 0)) {
      this.errorFormulario = 'El monto es obligatorio y debe ser mayor a 0.';
      return;
    }

    let descripcion: string;
    if (this.modo === 'pago') {
      descripcion = this.movForm.metodoPago;
    } else {
      const favor = this.editandoFila?.saldo_favor ?? 0;
      if (monto > favor) {
        this.errorFormulario = 'El cliente no tiene saldo a favor suficiente para este retiro.';
        return;
      }
      descripcion = this.movForm.descripcion.trim();
      if (!descripcion) {
        this.errorFormulario = 'Escribe una descripción del retiro.';
        return;
      }
    }

    const tipo = this.modo === 'pago' ? 'PAGO_EFECTIVO' : 'RETIRO';
    this.guardando = true;
    this.errorFormulario = '';
    this.movimientosSvc.crear({
      id_cliente: id,
      id_quiniela: null,
      tipo,
      monto,
      descripcion,
    }).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Movimiento registrado');
        this.cerrarModal();
        this.cargar();
      },
      error: (e) => {
        this.errorFormulario = e.message;
        this.guardando = false;
      },
    });
  }
}
