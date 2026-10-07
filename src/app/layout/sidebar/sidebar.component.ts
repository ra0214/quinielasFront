import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconoComponent, IconoNombre } from '../../ui/atoms/icono/icono.component';

export interface ItemMenu {
  ruta: string;
  etiqueta: string;
  icono: IconoNombre;
}

/** Organismo: navegación lateral del layout. */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconoComponent],
  template: `
    <aside class="sidebar">
      <div class="marca">
        <span class="marca-logo"><app-icono nombre="diana" tamano="26px" /></span>
        <div>
          <strong>Quinielas</strong>
          <small>Sistema de gestión</small>
        </div>
      </div>

      <nav>
        @for (item of items; track item.ruta) {
          <a [routerLink]="item.ruta" routerLinkActive="activo">
            <span class="icono"><app-icono [nombre]="item.icono" tamano="18px" /></span>
            {{ item.etiqueta }}
          </a>
        }
      </nav>

      <div class="sidebar-pie">v1.0</div>
    </aside>
  `,
  styles: `
    .sidebar {
      width: 230px;
      flex-shrink: 0;
      background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      height: 100vh;
    }

    .marca {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .marca-logo {
      font-size: 26px;
    }

    .marca strong {
      display: block;
      font-size: 16px;
      color: #fff;
    }

    .marca small {
      color: #94a3b8;
      font-size: 11px;
    }

    nav {
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    nav a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      color: #cbd5e1;
      text-decoration: none;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }

    nav a:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }

    nav a.activo {
      background: #2563eb;
      color: #fff;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }

    nav .icono {
      width: 20px;
      text-align: center;
    }

    .sidebar-pie {
      padding: 14px 18px;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
  `,
})
export class SidebarComponent {
  @Input() items: ItemMenu[] = [
    { ruta: '/clientes', etiqueta: 'Clientes', icono: 'usuarios' },
    { ruta: '/ediciones', etiqueta: 'Ediciones', icono: 'calendario' },
    { ruta: '/quinielas', etiqueta: 'Quinielas', icono: 'diana' },
    { ruta: '/saldos', etiqueta: 'Saldos', icono: 'billetera' },
    { ruta: '/aportes', etiqueta: 'Aportes', icono: 'monedas' },
    { ruta: '/movimientos', etiqueta: 'Movimientos', icono: 'recargar' },
    { ruta: '/premios', etiqueta: 'Premios', icono: 'copa' },
  ];
}
