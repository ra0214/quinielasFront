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
import { BuscadorComponent } from '../../ui/molecules/buscador/buscador.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { TablaComponent, ColumnaTabla } from '../../ui/organisms/tabla/tabla.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ClientesService } from './data-access/clientes.service';
import { MovimientosService } from '../movimientos/data-access/movimientos.service';
import { AportesService } from '../aportes/data-access/aportes.service';
import { SaldosService } from '../saldos/data-access/saldos.service';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    IconoComponent,
    FormsModule,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    BuscadorComponent,
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
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly clientes = signal<Cliente[]>([]);
  cargando = false;
  errorApi = '';

  get totalClientes(): string {
    return String(this.clientes().length);
  }

  // Búsqueda
  busqueda = '';

  readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Nombre' },
    { clave: 'telefono', etiqueta: 'Teléfono' },
    { clave: 'fecha_registro', etiqueta: 'Registro', tipo: 'fecha' },
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

  // Registros asociados (bloquean el borrado del cliente)
  registrosVisible = false;
  registrosCargando = false;
  registrosCliente: Cliente | null = null;
  registrosSaldo: Saldo | null = null;
  registrosMovimientos: Movimiento[] = [];
  registrosAportes: Aporte[] = [];
  erroresRegistros: string[] = [];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    this.datos.listar().subscribe({
      next: (lista) => {
        this.clientes.set(lista);
        this.cargando = false;
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargando = false;
      },
    });
  }

  buscar(termino: string): void {
    if (!termino.trim()) {
      this.cargar();
      return;
    }
    this.cargando = true;
    this.datos.buscar(termino.trim()).subscribe({
      next: (lista) => this.clientes.set(lista),
      error: (e) => (this.errorApi = e.message),
      complete: () => (this.cargando = false),
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
}
