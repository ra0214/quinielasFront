import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Cliente, ClienteRequest } from '../../core/domain/models';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { BuscadorComponent } from '../../ui/molecules/buscador/buscador.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { TablaComponent, ColumnaTabla } from '../../ui/organisms/tabla/tabla.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ClientesService } from './data-access/clientes.service';

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
        this.pendiente = null;
      },
    });
  }

  verMovimientos(c: Cliente): void {
    this.router.navigate(['/movimientos'], { queryParams: { cliente: c.id_cliente } });
  }
}
