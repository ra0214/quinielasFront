import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { formatoFecha, formatoMoneda, formatoPorcentaje } from '../../core/domain/helpers';
import { ParticipanteReparto, Premio, PremioRequest, Quiniela, RepartoPremio } from '../../core/domain/models';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { ConfirmDialogComponent } from '../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { ColumnaTabla, TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { SaldosService } from '../saldos/data-access/saldos.service';
import { QuinielasService } from '../quinielas/data-access/quinielas.service';
import { PremiosService } from './data-access/premios.service';

/** Premio enriquecido con el nombre de la quiniela para mostrar y ordenar la tabla. */
interface PremioVista extends Premio {
  nombre_quiniela: string;
}

@Component({
  selector: 'app-premios',
  standalone: true,
  imports: [
    IconoComponent,
    FormsModule,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    BadgeComponent,
    TablaComponent,
    CeldaDirective,
    ModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './premios.page.html',
  styleUrl: './premios.page.css',
})
export class PremiosPage implements OnInit {
  private readonly datos = inject(PremiosService);
  private readonly quinielasDatos = inject(QuinielasService);
  private readonly saldosDatos = inject(SaldosService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly premios = signal<Premio[]>([]);
  readonly quinielas = signal<Quiniela[]>([]);

  cargando = false;
  errorApi = '';

  readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre_quiniela', etiqueta: 'Quiniela' },
    { clave: 'monto_bruto', etiqueta: 'Monto bruto', tipo: 'moneda', clase: 'num' },
    { clave: 'porcentaje_retencion', etiqueta: 'Retención', tipo: 'porcentaje' },
    { clave: 'monto_neto', etiqueta: 'Monto neto', tipo: 'moneda', clase: 'num' },
    { clave: 'fecha_registro', etiqueta: 'Registro', tipo: 'fecha' },
    { clave: 'acciones', etiqueta: 'Acciones', clase: 'acciones', ordenable: false },
  ];

  readonly columnasParticipantes: ColumnaTabla[] = [
    { clave: 'nombre_cliente', etiqueta: 'Cliente' },
    { clave: 'monto_aporte', etiqueta: 'Aporte', tipo: 'moneda', clase: 'num' },
    { clave: 'porcentaje_aporte', etiqueta: '% Aporte', tipo: 'porcentaje', clase: 'num' },
    { clave: 'porcentaje_sobre_meta', etiqueta: '% Sobre meta', tipo: 'porcentaje', clase: 'num' },
    { clave: 'porcentaje_recompensa', etiqueta: '% Recompensa', tipo: 'porcentaje', clase: 'num' },
    { clave: 'monto_bruto_asignado', etiqueta: 'Bruto asignado', tipo: 'moneda', clase: 'num' },
    { clave: 'monto_retencion', etiqueta: 'Retención', tipo: 'moneda', clase: 'num' },
    { clave: 'monto_neto_asignado', etiqueta: 'Neto asignado', tipo: 'moneda', clase: 'num' },
  ];

  // Modal crear/editar premio
  modalVisible = false;
  editandoPremioId: number | null = null;
  formulario: PremioRequest = { id_quiniela: 0, monto_bruto: 0 };
  guardando = false;
  errorFormulario = '';

  // Modal reparto
  repartoModalVisible = false;
  repartoPremio: Premio | null = null;
  reparto: RepartoPremio | null = null;
  repartoCargando = false;
  repartoAviso = '';
  repartoGenerable = false;
  repartoError = '';
  generarConfirmado = false;

  // Modal publicación
  publicacionVisible = false;
  publicandoPremio: Premio | null = null;
  publicacionReparto: RepartoPremio | null = null;
  publicacionCargando = false;
  publicacionError = '';
  saldosPublicacion = new Map<number, number>();

  // Eliminar
  pendiente: Premio | null = null;

  ngOnInit(): void {
    this.cargar();
    this.cargarQuinielas();
  }

  get mapaQuinielas(): Record<number, string> {
    const mapa: Record<number, string> = {};
    for (const q of this.quinielas()) mapa[q.id_quiniela] = q.nombre_variante;
    return mapa;
  }

  get lista(): PremioVista[] {
    return this.premios().map((p) => ({
      ...p,
      nombre_quiniela: this.mapaQuinielas[p.id_quiniela] ?? `Quiniela #${p.id_quiniela}`,
    }));
  }

  get totalBruto(): string {
    return formatoMoneda(this.premios().reduce((s, p) => s + (p.monto_bruto || 0), 0));
  }

  get totalNeto(): string {
    return formatoMoneda(this.premios().reduce((s, p) => s + (p.monto_neto || 0), 0));
  }

  get totalRetenido(): string {
    const bruto = this.premios().reduce((s, p) => s + (p.monto_bruto || 0), 0);
    const neto = this.premios().reduce((s, p) => s + (p.monto_neto || 0), 0);
    return formatoMoneda(bruto - neto);
  }

  get totalPremios(): string {
    return String(this.premios().length);
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    this.datos.listar().subscribe({
      next: (lista) => {
        this.premios.set(lista);
        this.cargando = false;
      },
      error: (e) => {
        this.errorApi = e.message;
        this.cargando = false;
      },
    });
  }

  cargarQuinielas(): void {
    this.quinielasDatos.listar().subscribe({
      next: (lista) => this.quinielas.set(lista),
      error: (e) => this.toast.error(e.message),
    });
  }

  nombreQuiniela(id: number | null | undefined): string {
    if (id == null) return '';
    return this.mapaQuinielas[id] ?? `Quiniela #${id}`;
  }

  moneda(v: number): string {
    return formatoMoneda(v);
  }

  porcentaje(v: number): string {
    return formatoPorcentaje(v);
  }

  fecha(v: string): string {
    return formatoFecha(v);
  }

  entero(v: number): string {
    return String(v);
  }

  // ===== Modal crear/editar premio =====

  nuevo(): void {
    this.editandoPremioId = null;
    this.formulario = { id_quiniela: 0, monto_bruto: 0 };
    this.errorFormulario = '';
    this.guardando = false;
    this.modalVisible = true;
  }

  editar(p: Premio): void {
    this.editandoPremioId = p.id_premio;
    this.formulario = { id_quiniela: p.id_quiniela, monto_bruto: p.monto_bruto };
    this.errorFormulario = '';
    this.guardando = false;
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.editandoPremioId = null;
    this.guardando = false;
  }

  guardar(): void {
    const f = this.formulario;
    if (this.editandoPremioId === null && !f.id_quiniela) {
      this.errorFormulario = 'Selecciona una quiniela.';
      return;
    }
    if (!(f.monto_bruto > 0)) {
      this.errorFormulario = 'El monto bruto es obligatorio y debe ser mayor a 0.';
      return;
    }

    this.guardando = true;
    this.errorFormulario = '';
    const cuerpo: PremioRequest = { id_quiniela: f.id_quiniela, monto_bruto: f.monto_bruto };

    const peticion =
      this.editandoPremioId === null
        ? this.datos.crear(cuerpo)
        : this.datos.actualizar(this.editandoPremioId, cuerpo.monto_bruto);

    peticion.subscribe({
      next: (res) => {
        this.toast.exito(res.message || (this.editandoPremioId === null ? 'Premio registrado' : 'Premio actualizado'));
        this.cerrarModal();
        this.cargar();
      },
      error: (e) => {
        this.errorFormulario = e.message;
        this.guardando = false;
      },
    });
  }

  // ===== Modal reparto =====

  verReparto(p: Premio): void {
    this.repartoPremio = p;
    this.reparto = null;
    this.repartoAviso = '';
    this.repartoGenerable = false;
    this.repartoError = '';
    this.repartoModalVisible = true;
    this.cargarReparto();
  }

  cerrarReparto(): void {
    this.repartoModalVisible = false;
    this.generarConfirmado = false;
  }

  cargarReparto(): void {
    const p = this.repartoPremio;
    if (!p) return;
    this.repartoCargando = true;
    this.reparto = null;
    this.repartoAviso = '';
    this.repartoGenerable = false;
    this.repartoError = '';

    this.datos.obtenerReparto(p.id_quiniela).subscribe({
      next: (r) => {
        this.reparto = r;
        this.repartoCargando = false;
      },
      error: (e) => {
        this.repartoCargando = false;
        const status: number | undefined = e?.status;
        if (status === 404) {
          // Aún no existe reparto: se puede generar.
          this.repartoAviso = e.message;
          this.repartoGenerable = true;
        } else {
          // 409 / 400 u otros: el reparto no está disponible.
          this.repartoError = e.message;
        }
      },
    });
  }

  pedirGenerar(): void {
    this.generarConfirmado = true;
  }

  confirmarGenerar(): void {
    const p = this.repartoPremio;
    if (!p) return;
    this.generarConfirmado = false;
    this.repartoError = '';
    this.datos.generarReparto(p.id_quiniela).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Reparto generado');
        this.repartoAviso = '';
        this.repartoGenerable = false;
        this.reparto = res.reparto;
        this.cargar();
      },
      error: (e) => {
        this.toast.error(e.message);
        this.repartoAviso = '';
        this.repartoGenerable = false;
        this.repartoError = e.message;
      },
    });
  }

  verSaldos(): void {
    this.router.navigate(['/saldos']);
  }

  // ===== Publicación del premio =====

  publicar(p: Premio): void {
    this.publicandoPremio = p;
    this.publicacionReparto = null;
    this.saldosPublicacion = new Map();
    this.publicacionError = '';
    this.publicacionCargando = true;
    this.publicacionVisible = true;

    this.datos.obtenerReparto(p.id_quiniela).subscribe({
      next: (r) => {
        this.publicacionReparto = r;
        this.cargarSaldosPublicacion(r.participantes);
      },
      error: (e) => {
        this.publicacionCargando = false;
        this.publicacionError =
          e.message || 'No se pudo cargar el reparto. Genera el reparto antes de publicar.';
      },
    });
  }

  private cargarSaldosPublicacion(participantes: ParticipanteReparto[]): void {
    if (participantes.length === 0) {
      this.publicacionCargando = false;
      return;
    }
    const peticiones = participantes.map((p) =>
      this.saldosDatos.porCliente(p.id_cliente).pipe(
        map((s) => [p.id_cliente, Math.max(0, s.saldo_favor - s.saldo_deuda)] as const),
        catchError(() => of([p.id_cliente, 0] as const))
      )
    );
    forkJoin(peticiones).subscribe({
      next: (entradas) => {
        const mapa = new Map<number, number>();
        for (const [id, neto] of entradas) mapa.set(id, neto);
        this.saldosPublicacion = mapa;
        this.publicacionCargando = false;
      },
      error: () => {
        this.publicacionCargando = false;
      },
    });
  }

  saldoPublicado(idCliente: number): string {
    return formatoMoneda(this.saldosPublicacion.get(idCliente) ?? 0);
  }

  cerrarPublicacion(): void {
    this.publicacionVisible = false;
    this.publicandoPremio = null;
    this.publicacionReparto = null;
  }

  get fechaPublicacionPreview(): string {
    const r = this.publicacionReparto;
    if (!r) return '—';
    return this.fecha(r.fecha_reparto);
  }

  // ===== Eliminar =====

  eliminar(p: Premio): void {
    this.pendiente = p;
  }

  confirmarEliminacion(): void {
    const p = this.pendiente;
    if (!p) return;
    this.datos.eliminar(p.id_premio).subscribe({
      next: (res) => {
        this.toast.exito(res.message || 'Premio eliminado');
        this.pendiente = null;
        this.cargar();
      },
      error: (e) => {
        this.toast.error(e.message);
        this.pendiente = null;
      },
    });
  }
}
