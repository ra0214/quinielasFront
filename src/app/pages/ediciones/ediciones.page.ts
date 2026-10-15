import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Edicion, EdicionRequest } from '../../core/domain/models';
import { aRfc3339, deRfc3339AInput, etiquetaTipoEdicion, formatoFecha } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { EdicionesService } from './data-access/ediciones.service';

interface FormularioEdicion {
  tipo_edicion: string;
  nombre_edicion: string;
  fecha_limite: string; // valor de input datetime-local
}

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
    { clave: 'fecha_limite', etiqueta: 'Cierra', tipo: 'fecha' },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  // Modal crear/editar
  modalVisible = false;
  editandoId: number | null = null;
  formulario: FormularioEdicion = { tipo_edicion: 'FIN_DE_SEMANA', nombre_edicion: '', fecha_limite: '' };
  fechaInicioEditando = '';
  guardando = false;
  errorFormulario = '';

  // Modal de consulta info
  consultaVisible = false;

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
    return etiquetaTipoEdicion(tipo) || '—';
  }

  fecha(v: string): string {
    return formatoFecha(v);
  }

  /** Solo dígitos en "Número de concurso" (sin letras ni símbolos). */
  soloNumeros(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '');
    if (input.value !== limpio) {
      input.value = limpio;
      this.formulario.nombre_edicion = limpio;
    }
  }

  nuevo(): void {
    this.editandoId = null;
    this.formulario = { tipo_edicion: 'FIN_DE_SEMANA', nombre_edicion: '', fecha_limite: '' };
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
    this.formulario = {
      tipo_edicion: e.tipo_edicion,
      nombre_edicion: e.nombre_edicion,
      fecha_limite: deRfc3339AInput(e.fecha_limite),
    };
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
      this.errorFormulario = 'El número de concurso es obligatorio.';
      return;
    }
    if (!this.formulario.fecha_limite) {
      this.errorFormulario = 'La fecha límite es obligatoria.';
      return;
    }
    const cuerpo: EdicionRequest = {
      tipo_edicion: tipo,
      nombre_edicion: nombre,
      fecha_limite: aRfc3339(this.formulario.fecha_limite),
    };
    this.guardando = true;
    this.errorFormulario = '';
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

}