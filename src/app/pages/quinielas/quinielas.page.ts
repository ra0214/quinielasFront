import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AporteDetalle, Edicion, EstadoQuiniela, Quiniela, QuinielaRequest } from '../../core/domain/models';
import { aRfc3339, deRfc3339AInput, formatoMoneda } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ChipsFiltroComponent, OpcionChip } from '../../ui/molecules/chips-filtro/chips-filtro.component';
import { ConfirmDialogComponent } from '../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { AportesService } from '../aportes/data-access/aportes.service';
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
  precio: number | null;
  monto_meta: number | null;
  fecha_limite: string; // valor de input datetime-local
  estado: string;
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
    ConfirmDialogComponent,
    BadgeComponent,
  ],
  templateUrl: './quinielas.page.html',
  styleUrl: './quinielas.page.css',
})
export class QuinielasPage implements OnInit {
  private readonly datos = inject(QuinielasService);
  private readonly edicionesSvc = inject(EdicionesService);
  private readonly aportes = inject(AportesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly quinielas = signal<QuinielaVista[]>([]);
  readonly ediciones = signal<Edicion[]>([]);
  readonly progresos = signal<Record<number, ProgresoQuiniela>>({});
  cargando = false;
  errorApi = '';

  readonly variantes = ['Neto', 'Otros', 'Tlacuache', 'Salomón', 'Extra'];
  readonly estados: EstadoQuiniela[] = ['EN_JUEGO', 'COMPLETADA', 'CANCELADA'];

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
    { clave: 'nombre_edicion', etiqueta: 'Edición' },
    { clave: 'nombre_variante', etiqueta: 'Variante' },
    { clave: 'precio', etiqueta: 'Precio', tipo: 'moneda', clase: 'num' },
    { clave: 'monto_meta', etiqueta: 'Meta', tipo: 'moneda', clase: 'num' },
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

  // Eliminar
  pendiente: QuinielaVista | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  private formularioVacio(): FormularioQuiniela {
    const primera = this.ediciones()[0];
    return {
      id_edicion: primera ? primera.id_edicion : 0,
      nombre_variante: 'Neto',
      precio: null,
      monto_meta: null,
      fecha_limite: '',
      estado: 'EN_JUEGO',
    };
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    forkJoin({
      quinielas: this.datos.listar(),
      ediciones: this.edicionesSvc.listar(),
    }).subscribe({
      next: ({ quinielas, ediciones }) => {
        this.ediciones.set(ediciones);
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
    const peticiones = lista.map((q) =>
      this.aportes.porQuiniela(q.id_quiniela).pipe(
        catchError(() => of<AporteDetalle[] | null>(null)),
        map((aportes) => {
          if (!aportes) return null;
          const recaudado = aportes.reduce((suma, a) => suma + (a.monto_total_acumulado || 0), 0);
          const meta = q.monto_meta || 0;
          const faltante = meta - recaudado;
          const porcentaje = meta > 0 ? (recaudado / meta) * 100 : 0;
          return [q.id_quiniela, { recaudado, faltante, porcentaje }] as const;
        })
      )
    );
    forkJoin(peticiones).subscribe({
      next: (entradas) => {
        const mapa: Record<number, ProgresoQuiniela> = {};
        for (const entrada of entradas) {
          if (entrada) mapa[entrada[0]] = entrada[1];
        }
        this.progresos.set(mapa);
      },
      error: () => undefined,
    });
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

  nuevo(): void {
    this.editandoId = null;
    this.formulario = this.formularioVacio();
    this.errorFormulario = '';
    this.modalVisible = true;
  }

  editar(q: QuinielaVista): void {
    this.editandoId = q.id_quiniela;
    this.formulario = {
      id_edicion: q.id_edicion,
      nombre_variante: q.nombre_variante,
      precio: q.precio,
      monto_meta: q.monto_meta,
      fecha_limite: deRfc3339AInput(q.fecha_limite),
      estado: q.estado,
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
    if (f.precio == null || f.precio <= 0) {
      this.errorFormulario = 'El precio es obligatorio y debe ser mayor a 0.';
      return;
    }
    if (f.monto_meta != null && f.monto_meta < 0) {
      this.errorFormulario = 'El monto meta no puede ser negativo.';
      return;
    }
    if (!f.fecha_limite) {
      this.errorFormulario = 'La fecha y hora límite es obligatoria.';
      return;
    }
    if (this.editandoId !== null && !f.estado) {
      this.errorFormulario = 'Selecciona el estado de la quiniela.';
      return;
    }

    const cuerpo: QuinielaRequest = {
      id_edicion: f.id_edicion,
      nombre_variante: f.nombre_variante,
      precio: f.precio ?? 0,
      monto_meta: f.monto_meta ?? 0,
      fecha_limite: aRfc3339(f.fecha_limite),
    };
    this.guardando = true;
    this.errorFormulario = '';

    // POST sin estado: la quiniela nace EN_JUEGO.
    const peticion =
      this.editandoId === null
        ? this.datos.crear(cuerpo)
        : this.datos.actualizar(this.editandoId, { ...cuerpo, estado: f.estado });

    peticion.subscribe({
      next: (res) => {
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

  eliminar(q: QuinielaVista): void {
    this.pendiente = q;
  }

  confirmarEliminacion(): void {
    const q = this.pendiente;
    if (!q) return;
    this.datos.eliminar(q.id_quiniela).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Quiniela eliminada');
        this.pendiente = null;
        this.cargar();
      },
      error: (e) => {
        this.toast.error(e.message);
        this.pendiente = null;
      },
    });
  }

  abrirAportes(q: QuinielaVista): void {
    this.router.navigate(['/aportes'], { queryParams: { quiniela: q.id_quiniela } });
  }
}