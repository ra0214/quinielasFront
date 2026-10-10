import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Edicion, EdicionRequest } from '../../core/domain/models';
import { formatoFecha } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ConfirmDialogComponent } from '../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { EdicionesService } from './data-access/ediciones.service';

@Component({
  selector: 'app-ediciones',
  standalone: true,
  imports: [
    IconoComponent,
    FormsModule,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    TablaComponent,
    CeldaDirective,
    ModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './ediciones.page.html',
  styleUrl: './ediciones.page.css',
})
export class EdicionesPage implements OnInit {
  private readonly datos = inject(EdicionesService);
  private readonly toast = inject(ToastService);

  readonly ediciones = signal<Edicion[]>([]);
  cargando = false;
  errorApi = '';

  get totalEdiciones(): string {
    return String(this.ediciones().length);
  }

  readonly columnas: ColumnaTabla[] = [
    { clave: 'id_edicion', etiqueta: 'ID', tipo: 'numero' },
    { clave: 'tipo_edicion', etiqueta: 'Tipo' },
    { clave: 'nombre_edicion', etiqueta: 'Número' },
    { clave: 'fecha_inicio', etiqueta: 'Inicio', tipo: 'fecha' },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  // Modal crear/editar
  modalVisible = false;
  editandoId: number | null = null;
  formulario: EdicionRequest = { tipo_edicion: 'FIN_DE_SEMANA', nombre_edicion: '' };
  fechaInicioEditando = '';
  guardando = false;
  errorFormulario = '';

  // Modal de consulta info
  consultaVisible = false;

  // Eliminar
  pendiente: Edicion | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    this.datos.listar().subscribe({
      next: (lista) => {
        this.ediciones.set(lista);
        this.cargando = false;
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargando = false;
      },
    });
  }

  contar(tipo: string): string {
    return String(this.ediciones().filter((e) => e.tipo_edicion === tipo).length);
  }

  etiquetaTipo(tipo: string): string {
    if (tipo === 'MEDIA_SEMANA') return 'Media semana';
    if (tipo === 'FIN_DE_SEMANA') return 'Fin de semana';
    return tipo || '—';
  }

  fecha(v: string): string {
    return formatoFecha(v);
  }

  nuevo(): void {
    this.editandoId = null;
    this.formulario = { tipo_edicion: 'FIN_DE_SEMANA', nombre_edicion: '' };
    this.fechaInicioEditando = '';
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  abrirConsulta(): void {
    this.consultaVisible = true;
  }

  cerrarConsulta(): void {
    this.consultaVisible = false;
  }

  abrirMediaSemana(): void {
    window.open('https://www.loterianacional.gob.mx/ProgolMediaSemana/Quiniela', '_blank', 'noopener,noreferrer');
    this.cerrarConsulta();
  }

  abrirFinSemana(): void {
    window.open('https://www.loterianacional.gob.mx/Progol/Momios', '_blank', 'noopener,noreferrer');
    this.cerrarConsulta();
  }

  editar(e: Edicion): void {
    this.editandoId = e.id_edicion;
    this.formulario = { tipo_edicion: e.tipo_edicion, nombre_edicion: e.nombre_edicion };
    this.fechaInicioEditando = e.fecha_inicio;
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.guardando = false;
  }

  guardar(): void {
    const tipo = this.formulario.tipo_edicion;
    const nombre = this.formulario.nombre_edicion.trim();
    if (tipo !== 'MEDIA_SEMANA' && tipo !== 'FIN_DE_SEMANA') {
      this.errorFormulario = 'Selecciona un tipo de edición.';
      return;
    }
    if (!nombre) {
      this.errorFormulario = 'El nombre de la edición es obligatorio.';
      return;
    }
    const cuerpo: EdicionRequest = { tipo_edicion: tipo, nombre_edicion: nombre };
    this.guardando = true;
    this.errorFormulario = '';

    const peticion =
      this.editandoId === null
        ? this.datos.crear(cuerpo)
        : this.datos.actualizar(this.editandoId, cuerpo);

    peticion.subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Guardado correctamente');
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

  eliminar(e: Edicion): void {
    this.pendiente = e;
  }

  confirmarEliminacion(): void {
    const e = this.pendiente;
    if (!e) return;
    this.datos.eliminar(e.id_edicion).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Edición eliminada');
        this.pendiente = null;
        this.cargar();
      },
      error: (err) => {
        this.toast.error(err.message);
        this.pendiente = null;
      },
    });
  }
}