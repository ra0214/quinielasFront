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

/** Modo del modal: ajuste directo, captura de pago o captura de retiro. */
type ModoModal = 'ajuste' | 'pago' | 'retiro';

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
    { clave: 'saldo_favor', etiqueta: 'Monto a favor', tipo: 'moneda', clase: 'num' },
    { clave: 'saldo_deuda', etiqueta: 'Monto deuda', tipo: 'moneda', clase: 'num' },
    { clave: 'neto', etiqueta: 'Neto', clase: 'num' },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  // Modal editar saldo
  modalVisible = false;
  modo: ModoModal = 'ajuste';
  editandoId: number | null = null;
  editandoFila: FilaSaldo | null = null;
  form: { saldo_favor: number | null; saldo_deuda: number | null } = { saldo_favor: 0, saldo_deuda: 0 };
  movForm: { monto: number | null; descripcion: string } = { monto: null, descripcion: '' };
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

  get conDeuda(): number {
    return this.filas().filter((f) => f.saldo_deuda > 0).length;
  }

  get enCero(): number {
    return this.filas().filter((f) => f.saldo_favor === 0 && f.saldo_deuda === 0).length;
  }

  get conDeudaTexto(): string {
    return String(this.conDeuda);
  }

  get enCeroTexto(): string {
    return String(this.enCero);
  }

  moneda(v: number): string {
    return formatoMoneda(v);
  }

  /** el saldo neto negativo se muestra en 0. */
  netoTexto(f: FilaSaldo): string {
    return formatoMoneda(Math.max(0, f.neto));
  }

  // ===== Edición rápida =====
  editar(f: FilaSaldo): void {
    this.editandoId = f.id_cliente;
    this.editandoFila = f;
    this.modo = 'ajuste';
    this.form = { saldo_favor: f.saldo_favor, saldo_deuda: f.saldo_deuda };
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  pago(f: FilaSaldo): void {
    this.abrirMovimiento(f, 'pago', 'Pago en efectivo');
  }

  retiro(f: FilaSaldo): void {
    this.abrirMovimiento(f, 'retiro', 'Retiro en ventanilla');
  }

  private abrirMovimiento(f: FilaSaldo, modo: 'pago' | 'retiro', descripcionPorDefecto: string): void {
    this.editandoId = f.id_cliente;
    this.editandoFila = f;
    this.modo = modo;
    this.movForm = { monto: null, descripcion: descripcionPorDefecto };
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
    if (this.modo === 'retiro') return `Registrar retiro · ${nombre}`;
    return `Editar saldo · ${nombre}`;
  }

  get lenguajeModal(): string {
    if (this.modo === 'pago') return 'El pago reduce la deuda del cliente y, si sobra, se acumula a su favor.';
    if (this.modo === 'retiro') return 'El retiro se cobra del saldo a favor del cliente y queda registrado como movimiento.';
    return 'Los saldos no pueden ser negativos.';
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

    if (this.modo === 'ajuste') {
      this.guardarAjuste(id);
      return;
    }

    const monto = this.movForm.monto === null || isNaN(this.movForm.monto) ? 0 : this.movForm.monto;
    if (!(monto > 0)) {
      this.errorFormulario = 'El monto es obligatorio y debe ser mayor a 0.';
      return;
    }
    if (this.modo === 'retiro') {
      const favor = this.editandoFila?.saldo_favor ?? 0;
      if (monto > favor) {
        this.errorFormulario = 'El cliente no tiene saldo a favor suficiente para este retiro.';
        return;
      }
    }
    if (!this.movForm.descripcion.trim()) {
      this.errorFormulario = 'Escribe una descripción del movimiento.';
      return;
    }

    const tipo = this.modo === 'pago' ? 'PAGO_EFECTIVO' : 'RETIRO';
    this.guardando = true;
    this.errorFormulario = '';
    this.movimientosSvc.crear({
      id_cliente: id,
      id_quiniela: null,
      tipo,
      monto,
      descripcion: this.movForm.descripcion.trim(),
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

  private guardarAjuste(id: number): void {
    const favor = this.form.saldo_favor === null || isNaN(this.form.saldo_favor) ? 0 : this.form.saldo_favor;
    const deuda = this.form.saldo_deuda === null || isNaN(this.form.saldo_deuda) ? 0 : this.form.saldo_deuda;

    if (favor < 0 || deuda < 0) {
      this.errorFormulario = 'Los saldos no pueden ser negativos.';
      return;
    }

    this.guardando = true;
    this.errorFormulario = '';

    // La API toma los campos ausentes como 0: siempre enviamos ambos.
    this.datos.editar(id, { saldo_favor: favor, saldo_deuda: deuda }).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Saldo actualizado correctamente');
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
