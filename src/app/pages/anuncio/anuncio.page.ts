import { IconoComponent } from '../../ui/atoms/icono/icono.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AporteDetalle, Edicion, Quiniela } from '../../core/domain/models';
import { formatoFecha, formatoMoneda, formatoPorcentaje } from '../../core/domain/helpers';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../ui/atoms/badge/badge.component';
import { TarjetaResumenComponent } from '../../ui/atoms/tarjeta-resumen/tarjeta-resumen.component';
import { EncabezadoPaginaComponent } from '../../ui/organisms/encabezado-pagina/encabezado-pagina.component';
import { AportesService } from '../aportes/data-access/aportes.service';
import { EdicionesService } from '../ediciones/data-access/ediciones.service';
import { QuinielasService } from '../quinielas/data-access/quinielas.service';

interface ClienteAnuncio {
  nombre: string;
  porcentaje: number;
  monto: number;
}

interface AnuncioQuiniela {
  id_quiniela: number;
  variante: string;
  edicion: string;
  precio: number;
  monto_meta: number;
  fecha_limite: string;
  estado: string;
  recaudado: number;
  faltante: number;
  vencida: boolean;
  clientes: ClienteAnuncio[];
}

type TonoAnuncio = 'completada' | 'cancelable' | 'cancelada' | 'activa';

@Component({
  selector: 'app-anuncio',
  standalone: true,
  imports: [
    IconoComponent,
    FormsModule,
    EncabezadoPaginaComponent,
    TarjetaResumenComponent,
    BadgeComponent,
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

  // ===== DATOS DE EJEMPLO (reemplazar por los reales) =====
  // Todo lo de este bloque es de muestra para que el anuncio se vea completo;
  // cuando tengan los datos definitivos solo se cambian estos valores.
  readonly publicador = 'Organización de Quinielas «El Buen Amigo»';
  readonly contacto = {
    telefono: '+58 000-000-0000',
    whatsapp: '+58 000-000-0000',
    correo: 'ejemplo@correo.com',
  };
  readonly horario = [
    { dia: 'Lunes a Viernes', hora: '8:00 am – 6:00 pm' },
    { dia: 'Sábados', hora: '8:00 am – 1:00 pm' },
    { dia: 'Domingos y feriados', hora: 'Cerrado' },
  ];
  readonly transferencias = [
    {
      banco: 'Banco de Ejemplo',
      titular: 'Ejemplo Apellido, C.I. V-00.000.000',
      cuenta: '0102-0000-00-0000000000',
      tipo: 'Ahorro',
    },
    {
      banco: 'Banco de Ejemplo 2',
      titular: 'Ejemplo Apellido, C.I. V-00.000.000',
      cuenta: '0105-0000-00-0000000000',
      tipo: 'Corriente',
    },
  ];
  readonly pagoMovil = {
    banco: 'Banco de Ejemplo',
    telefono: '000-0000000',
    cedula: 'V-00.000.000',
  };
  readonly notaAportes =
    'Indica tu nombre y teléfono en la referencia de la transferencia, o envíanos el ' +
    'comprobante por WhatsApp, para acreditar tu aporte.';

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
        const nombresEdicion = new Map(ediciones.map((e) => [e.id_edicion, e.nombre_edicion]));
        this.cargarAportes(quinielas, nombresEdicion);
      },
      error: (e) => {
        this.cargando = false;
        this.errorApi = e.message;
      },
    });
  }

  private cargarAportes(quinielas: Quiniela[], nombresEdicion: Map<number, string>): void {
    const peticiones = quinielas.map((q) =>
      this.aportesSvc.porQuiniela(q.id_quiniela).pipe(
        catchError(() => of<AporteDetalle[]>([])),
        map((aportes) => this.aAnuncio(q, aportes, nombresEdicion))
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

  private aAnuncio(q: Quiniela, aportes: AporteDetalle[], nombresEdicion: Map<number, string>): AnuncioQuiniela {
    const recaudado = aportes.reduce((suma, a) => suma + (a.monto_total_acumulado || 0), 0);
    const faltante = (q.monto_meta || 0) - recaudado;
    return {
      id_quiniela: q.id_quiniela,
      variante: q.nombre_variante,
      edicion: nombresEdicion.get(q.id_edicion) ?? `Edición #${q.id_edicion}`,
      precio: q.precio,
      monto_meta: q.monto_meta,
      fecha_limite: q.fecha_limite,
      estado: q.estado,
      recaudado,
      faltante,
      vencida: q.fecha_limite ? new Date(q.fecha_limite).getTime() <= Date.now() : false,
      clientes: aportes
        .filter((a) => a.monto_total_acumulado > 0)
        .map((a) => ({
          nombre: a.nombre_cliente,
          porcentaje: a.porcentaje_participacion,
          monto: a.monto_total_acumulado,
        }))
        .sort((a, b) => b.porcentaje - a.porcentaje),
    };
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
}