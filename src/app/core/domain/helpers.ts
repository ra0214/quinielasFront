/** Utilidades de presentación y ordenamiento para tablas. */

export function ordenar<T>(items: T[], columna: string, asc: boolean): T[] {
  return [...items].sort((a, b) => {
    const va = valor(a, columna);
    const vb = valor(b, columna);
    let cmp = 0;
    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' });
    }
    return asc ? cmp : -cmp;
  });
}

function valor(obj: unknown, columna: string): string | number {
  const partes = columna.split('.');
  let actual: unknown = obj;
  for (const p of partes) {
    if (actual == null) return '';
    actual = (actual as Record<string, unknown>)[p];
  }
  if (actual == null) return '';
  if (typeof actual === 'number') return actual;
  return String(actual);
}

export function formatoMoneda(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '$0.00';
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

export function formatoPorcentaje(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '0.0000%';
  return `${v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}%`;
}

export function formatoFecha(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatoFechaCorta(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Convierte un valor datetime-local (yyyy-MM-ddTHH:mm) a RFC3339 con offset local. */
export function aRfc3339(valorLocal: string): string {
  if (!valorLocal) return '';
  const d = new Date(valorLocal);
  const offset = -d.getTimezoneOffset();
  const signo = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const iso = d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0') +
    'T' + String(d.getHours()).padStart(2, '0') +
    ':' + String(d.getMinutes()).padStart(2, '0') +
    ':' + String(d.getSeconds()).padStart(2, '0');
  return `${iso}${signo}${hh}:${mm}`;
}

/** Convierte RFC3339 de la API al formato de input datetime-local. */
export function deRfc3339AInput(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
