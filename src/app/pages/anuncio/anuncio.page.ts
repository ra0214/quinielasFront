import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import html2canvas from 'html2canvas';
import { AporteDetalle, Edicion, Quiniela } from '../../core/domain/models';
import { etiquetaQuiniela, formatoFecha, formatoMoneda, formatoPorcentaje } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { ModalComponent } from '../../ui/molecules/modal/modal.component';
import { TablaComponent } from '../../ui/organisms/tabla/tabla.component';
import { ColumnaTabla } from '../../ui/organisms/tabla/tabla.component';
import { CeldaDirective } from '../../ui/organisms/tabla/celda.directive';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { AportesService } from '../aportes/data-access/aportes.service';
import { EdicionesService } from '../ediciones/data-access/ediciones.service';
import { QuinielasService } from '../quinielas/data-access/quinielas.service';

interface ClienteAnuncio {
  id_cliente: number;
  nombre: string;
  porcentaje: number;
  monto: number;
}

interface AnuncioQuiniela {
  id_quiniela: number;
  variante: string;
  edicion: string;
  etiqueta: string;
  monto_meta: number;
  fecha_limite: string;
  estado: string;
  recaudado: number;
  faltante: number;
  vencida: boolean;
  clientes: ClienteAnuncio[];
}

/** Columna del tablero exportable: una quiniela activa. */
interface ColumnaTablero {
  id_quiniela: number;
  titulo: string;
  color: string;
  meta: number;
  acumulado: number;
  falta: number;
}

interface CeldaTablero {
  monto: number;
  porcentaje: number;
}

interface FilaTablero {
  id_cliente: number;
  nombre: string;
  celdas: CeldaTablero[];
  total: number;
}

type TonoAnuncio = 'completada' | 'cancelable' | 'cancelada' | 'activa';

@Component({
  selector: 'app-anuncio',
  standalone: true,
  imports: [
    IconoComponent,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    BadgeComponent,
    ModalComponent,
    TablaComponent,
  ],
  templateUrl: './anuncio.page.html',
  styleUrl: './anuncio.page.css',
})
export class AnuncioPage implements OnInit {
  private readonly quinielasSvc = inject(QuinielasService);
  private readonly edicionesSvc = inject(EdicionesService);
  private readonly aportesSvc = inject(AportesService);
  private readonly toast = inject(ToastService);

  readonly anuncios = signal<AnuncioQuiniela[]>([]);
  cargando = true;
  errorApi = '';
  modalAportesVisible = false;
  modalQuiniela: AnuncioQuiniela | null = null;
  exportando = false;

  readonly columnasAportes: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Participante' },
    { clave: 'monto', etiqueta: 'Monto' },
    { clave: 'porcentaje', etiqueta: '% Participación' },
  ];

  // ===== Aviso y datos de pago / contacto / reglas =====
  readonly avisoAporte =
    'Indica tu nombre y teléfono en la referencia de la transferencia, o envíanos el ' +
    'comprobante por WhatsApp, para acreditar tu aporte.';

  readonly pago = {
    titulo: 'Aportaciones Para PROGOL',
    nota: 'Los aportes solo se anotarán una vez PAGADOS y CONFIRMADOS en la cuenta de:',
    banco: 'COMPARTAMOS (TRANSFERENCIAS, SPEI)',
    titular: 'Marvey Ramirez Herrera',
    clabe: '130100001667244557',
  };

  readonly ventanilla = 'Lunes a Sábado 10:00 am - 9:00 pm · Domingos 10:00 am - 8:00 pm';
  readonly telefonoWhatsapp = '9616957829';

  readonly reglas: string[] = [
    'Todos los aportes deberán ser cubiertos y reportados antes de la hora establecida o cierre de aportes (en cuanto se alcance la meta).',
    'Pueden usar los saldos de premios antes de cobrar el premio.',
    'Para pagos de premios anticipados (que sean cobrados en efectivo y siguen siendo boletos) tendrá un cargo de 5% de lo que retiren.',
    'Una vez cobrado los premios no tendrán ningún cargo por mi parte, salvo los gastos de depósito (por ejemplo, en un Oxxo).',
    'Se cancelan las quinielas si el creador de la quiniela así lo pide; los aportes quedarán como saldo a favor.',
    'Deberán indicar a qué quiniela será su aporte, o permanecerá como saldo a favor solamente (sin concursar).',
    'Todas las aportaciones reunidas y pagadas se jugarán lo más parecido a la quiniela propuesta. En caso de no poder ponerse tal cual, la propuesta se modificará quitando dobles y triples, poniendo revanchas o quinielas extras, pero siempre tratando de cubrir la propuesta; o simplemente se cancela.',
    'El límite de aportes es el día del cierre del concurso, 4 horas antes o cuando se cierren los aportes (lo que ocurra primero).',
    'Debido a tantos usuarios, les pido de favor que estén pendientes de sus aportes y me avisen si algo está mal, para evitar que se queden fuera de la jugada.',
    'Debido a las dificultades para cobrar los premios, a todo premio le descontaré 1%, a menos que por unanimidad del grupo se le dé a otra persona.',
    'Esta encomienda y todos los premios generarán el 17% de impuestos del estado de Chiapas: 7% de retenciones y 10% que cobran al reportarlo ante Hacienda en premios mayores a $10,000.',
  ];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorApi = '';
    forkJoin({
      quinielas: this.quinielasSvc.listar(),
      ediciones: this.edicionesSvc.listar(),
    }).subscribe({
      next: ({ quinielas, ediciones }) => {
        this.cargarAportes(quinielas, ediciones);
      },
      error: (e) => {
        this.cargando = false;
        this.errorApi = e.message;
      },
    });
  }

  private cargarAportes(quinielas: Quiniela[], ediciones: Edicion[]): void {
    const tiposEdicion = new Map(ediciones.map((e) => [e.id_edicion, e.tipo_edicion]));
    const nombresEdicion = new Map(ediciones.map((e) => [e.id_edicion, e.nombre_edicion]));
    const peticiones = quinielas.map((q) =>
      this.aportesSvc.porQuiniela(q.id_quiniela).pipe(
        catchError(() => of<AporteDetalle[]>([])),
        map((aportes) => this.aAnuncio(q, aportes, tiposEdicion, nombresEdicion))
      )
    );
    forkJoin(peticiones).subscribe({
      next: (lista) => {
        this.anuncios.set(lista);
        this.cargando = false;
      },
      error: (e) => {
        this.cargando = false;
        this.toast.error(e.message);
      },
    });
  }

  private aAnuncio(
    q: Quiniela,
    aportes: AporteDetalle[],
    tiposEdicion: Map<number, string>,
    nombresEdicion: Map<number, string>
  ): AnuncioQuiniela {
    const recaudado = aportes.reduce((suma, a) => suma + (a.monto_total_acumulado || 0), 0);
    const faltante = (q.monto_meta || 0) - recaudado;
    return {
      id_quiniela: q.id_quiniela,
      variante: q.nombre_variante,
      edicion: nombresEdicion.get(q.id_edicion) ?? `Edición #${q.id_edicion}`,
      etiqueta: etiquetaQuiniela(q.nombre_variante, tiposEdicion.get(q.id_edicion), nombresEdicion.get(q.id_edicion), q.id_quiniela),
      monto_meta: q.monto_meta,
      fecha_limite: q.fecha_limite,
      estado: q.estado,
      recaudado,
      faltante,
      vencida: q.fecha_limite ? new Date(q.fecha_limite).getTime() <= Date.now() : false,
      clientes: aportes
        .filter((a) => a.monto_total_acumulado > 0)
        .map((a) => ({
          id_cliente: a.id_cliente,
          nombre: a.nombre_cliente,
          porcentaje: a.porcentaje_participacion,
          monto: a.monto_total_acumulado,
        }))
        .sort((a, b) => b.porcentaje - a.porcentaje),
    };
  }

  // ===== Tablero exportable =====

  private readonly coloresTablero = ['color-0', 'color-1', 'color-2', 'color-3', 'color-4', 'color-5'];

  get activas(): AnuncioQuiniela[] {
    return this.anuncios().filter((q) => q.estado === 'EN_JUEGO');
  }

  get columnasTablero(): ColumnaTablero[] {
    return this.activas.map((q, i) => ({
      id_quiniela: q.id_quiniela,
      titulo: q.etiqueta,
      color: this.coloresTablero[i % this.coloresTablero.length],
      meta: q.monto_meta,
      acumulado: q.recaudado,
      falta: Math.max(0, q.faltante),
    }));
  }

  get filasTablero(): FilaTablero[] {
    const columnas = this.activas;
    const participantes = new Map<number, string>();
    for (const q of columnas) {
      for (const c of q.clientes) participantes.set(c.id_cliente, c.nombre);
    }
    const filas: FilaTablero[] = [];
    for (const [id, nombre] of participantes) {
      const celdas: CeldaTablero[] = columnas.map((q) => {
        const cliente = q.clientes.find((c) => c.id_cliente === id);
        return { monto: cliente?.monto ?? 0, porcentaje: cliente?.porcentaje ?? 0 };
      });
      filas.push({
        id_cliente: id,
        nombre,
        celdas,
        total: celdas.reduce((s, c) => s + c.monto, 0),
      });
    }
    return filas.sort((a, b) => b.total - a.total);
  }

  get anchoTotalTablero(): number {
    return 1 + this.columnasTablero.length * 2;
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

  faltanteVisible(q: AnuncioQuiniela): string {
    return formatoMoneda(Math.max(0, q.faltante));
  }

  anchoProgreso(q: AnuncioQuiniela): number {
    if (!(q.monto_meta > 0)) return 0;
    return Math.min(100, (q.recaudado / q.monto_meta) * 100);
  }

  tono(q: AnuncioQuiniela): TonoAnuncio {
    if (q.estado === 'COMPLETADA') return 'completada';
    if (q.estado === 'CANCELADA') return 'cancelada';
    if (q.vencida && q.faltante > 0) return 'cancelable';
    return 'activa';
  }

  tituloEstado(q: AnuncioQuiniela): string {
    switch (this.tono(q)) {
      case 'completada':
        return 'Quiniela completada';
      case 'cancelable':
        return 'Sujeta a cancelación: no alcanzó la meta a tiempo';
      case 'cancelada':
        return 'Quiniela cancelada';
      default:
        return 'Aún recibe aportes';
    }
  }

  get porcentajeMeta(): number {
    const suma = this.anuncios().reduce((acc, q) => acc + q.recaudado, 0);
    const metas = this.anuncios().reduce((acc, q) => acc + (q.monto_meta || 0), 0);
    return metas > 0 ? (suma / metas) * 100 : 0;
  }

  get totalRecaudado(): string {
    return this.moneda(this.anuncios().reduce((acc, q) => acc + q.recaudado, 0));
  }

  get totalResta(): number {
    return this.anuncios().reduce((acc, q) => acc + Math.max(0, q.faltante), 0);
  }

  get enJuego(): string {
    return String(this.anuncios().filter((q) => q.estado === 'EN_JUEGO').length);
  }

  get completadas(): string {
    return String(this.anuncios().filter((q) => q.estado === 'COMPLETADA').length);
  }

  // ===== Acciones =====

  verAportes(q: AnuncioQuiniela): void {
    this.modalQuiniela = q;
    this.modalAportesVisible = true;
  }

  cerrarModalAportes(): void {
    this.modalAportesVisible = false;
    this.modalQuiniela = null;
  }

  /** Lleva al tablero de aportes (participación con un clic). */
  irATablero(): void {
    document.getElementById('exportable-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async exportarImagen(): Promise<void> {
    const nodo = document.getElementById('exportable-board');
    if (!nodo || this.exportando) return;

    this.exportando = true;
    const anchoPrevio = nodo.style.width;
    // Ancho fijo al exportar para que las columnas no se rompan.
    nodo.style.width = '1200px';
    nodo.classList.add('exportando');

    try {
      const canvas = await html2canvas(nodo, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        windowWidth: nodo.scrollWidth,
      });
      const enlace = document.createElement('a');
      enlace.href = canvas.toDataURL('image/png');
      enlace.download = `lista-de-aportes-${this.selloFecha()}.png`;
      enlace.click();
      this.toast.exito('Imagen generada correctamente');
    } catch {
      this.toast.error('No se pudo generar la imagen');
    } finally {
      nodo.style.width = anchoPrevio;
      nodo.classList.remove('exportando');
      this.exportando = false;
    }
  }

  imprimir(): void {
    window.print();
  }

  private selloFecha(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
}
