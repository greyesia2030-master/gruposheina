import ExcelJS from 'exceljs';
import type { ParseResult, ParsedWeek, ParsedDay, ParsedOption } from './types';

const DAY_NAMES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  'LUNES': 1,
  'MARTES': 2,
  'MIERCOLES': 3,
  'MIÉRCOLES': 3,
  'JUEVES': 4,
  'VIERNES': 5,
};

// Letras que indican feriado/pendiente en la columna de cantidad (solo si la celda tiene exactamente ese valor)
const FERIADO_LETTERS = new Set(['F', 'E', 'R', 'I', 'A', 'D', 'O']);

type Cell = string | number | null;
type Row = Cell[];

/**
 * Parsea un archivo Excel con el formato específico de Grupo Sheina.
 * Detecta semanas, días, opciones de menú y anomalías.
 *
 * Usa ExcelJS (en reemplazo de `xlsx`, que tiene CVEs sin parchear de
 * prototype pollution y ReDoS).
 */
export async function parseSheinaExcel(buffer: Buffer): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const weeks: ParsedWeek[] = [];

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return {
      weeks: [],
      errors: ['No se pudo leer el archivo Excel. Verificá que el formato sea .xlsx'],
      warnings: [],
    };
  }

  if (workbook.worksheets.length === 0) {
    return { weeks: [], errors: ['El archivo Excel no contiene hojas'], warnings: [] };
  }

  for (const sheet of workbook.worksheets) {
    const rows = sheetToRows(sheet);

    if (rows.length < 3) {
      warnings.push(`Hoja "${sheet.name}" tiene muy pocas filas, se omite`);
      continue;
    }

    const week = parseSheet(sheet.name, rows, errors, warnings);
    if (week) {
      weeks.push(week);
    }
  }

  if (weeks.length === 0 && errors.length === 0) {
    errors.push('No se encontraron datos de pedidos en ninguna hoja');
  }

  return { weeks, errors, warnings };
}

/**
 * Convierte una hoja de ExcelJS a una matriz 2D de celdas planas.
 * Usa actualRowCount (más confiable para hojas con datos al final) y garantiza
 * un mínimo de 12 columnas para no perder datos en hojas con columnCount bajo.
 */
function sheetToRows(sheet: ExcelJS.Worksheet): Row[] {
  const rows: Row[] = [];
  // actualRowCount es más confiable para archivos con formato extendido
  const rowCount = (sheet as unknown as { actualRowCount?: number }).actualRowCount ?? sheet.rowCount;
  // Garantizar mínimo 12 columnas (adm=col5, vtas=col6, diet=col7, log=col8, otros=col9)
  const colCount = Math.max(sheet.columnCount, 12);

  for (let r = 1; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    const flat: Row = [];
    let hasValue = false;

    for (let c = 1; c <= colCount; c++) {
      const raw = row.getCell(c).value;
      const normalized = normalizeCell(raw);
      flat.push(normalized);
      if (normalized !== null && normalized !== '') hasValue = true;
    }

    // blankrows: false — omitir filas totalmente vacías
    if (hasValue) rows.push(flat);
  }

  return rows;
}

function normalizeCell(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();

  // Rich text, hyperlinks, formulas, errors
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join('');
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('result' in value) {
      const r = (value as { result: unknown }).result;
      if (typeof r === 'number' || typeof r === 'string') return r;
      return null;
    }
    if ('error' in value) return null;
  }

  return null;
}

function parseSheet(
  sheetName: string,
  rows: Row[],
  errors: string[],
  warnings: string[]
): ParsedWeek | null {
  const weekLabel = detectWeekLabel(sheetName, rows);
  const departments = detectDepartments(rows);

  const days: ParsedDay[] = [];
  let currentDay: { name: string; dayOfWeek: 1 | 2 | 3 | 4 | 5; rows: Row[] } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const col1 = String(row[1] ?? '').trim().toUpperCase();
    const newDow = DAY_NAMES[col1];

    if (newDow !== undefined) {
      if (!currentDay) {
        // First day encountered
        currentDay = { name: col1, dayOfWeek: newDow, rows: [row] };
      } else if (currentDay.dayOfWeek !== newDow) {
        // Transitioning to a DIFFERENT day — flush previous
        const day = parseDayRows(currentDay.name, currentDay.dayOfWeek, currentDay.rows, departments, warnings);
        if (day) days.push(day);
        currentDay = { name: col1, dayOfWeek: newDow, rows: [row] };
      } else {
        // Same day name repeated (Sheina Excel repeats day name for every option row)
        currentDay.rows.push(row);
      }
    } else if (currentDay) {
      currentDay.rows.push(row);
    }
  }

  // Push the last day — VIERNES is the last and this is the most common failure point
  if (currentDay) {
    const day = parseDayRows(currentDay.name, currentDay.dayOfWeek, currentDay.rows, departments, warnings);
    if (day) days.push(day);
  }

  if (days.length === 0) {
    errors.push(`Hoja "${sheetName}": no se encontraron días (LUNES-VIERNES)`);
    return null;
  }

  return { weekLabel, sheetName, days };
}

function detectWeekLabel(sheetName: string, rows: Row[]): string {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const val = String(rows[i]?.[0] ?? '').trim();
    if (val && /semana/i.test(val)) return val;
    if (/\d{1,2}[.\-/]\d{1,2}\s*(al|AL)\s*\d{1,2}[.\-/]\d{1,2}/.test(val)) return val;
  }
  // Also check column 1
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const val = String(rows[i]?.[1] ?? '').trim();
    if (val && /semana/i.test(val)) return val;
  }
  return sheetName;
}

function detectDepartments(rows: Row[]): string[] {
  const defaults = ['adm', 'vtas', 'diet', 'log', 'otros'];

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length < 6) continue;

    const candidates = [];
    for (let col = 5; col < Math.min(12, row.length); col++) {
      const val = String(row[col] ?? '').trim().toLowerCase();
      if (val && !/^\d+$/.test(val)) {
        candidates.push(val);
      }
    }
    if (candidates.length >= 3) {
      return candidates;
    }
  }

  return defaults;
}

function parseDayRows(
  dayName: string,
  dayOfWeek: 1 | 2 | 3 | 4 | 5,
  rows: Row[],
  departments: string[],
  warnings: string[]
): ParsedDay | null {
  const options: ParsedOption[] = [];
  let totalFromSheet = 0;

  for (const row of rows) {
    const col2 = String(row[2] ?? '').trim();
    const col3 = String(row[3] ?? '').trim();
    const col4Raw = row[4];

    // TOTALES row — marks end of day options, extract sheet total
    if (/totales?/i.test(col3)) {
      const total = parseFloat(String(col4Raw ?? '0'));
      if (!isNaN(total)) totalFromSheet = total;
      continue;
    }

    // Skip rows without option code or name
    if (!col2 || !col3) continue;

    const anomalies: string[] = [];
    let mainQty = 0;

    if (col4Raw === null || col4Raw === undefined || col4Raw === '') {
      mainQty = 0;
    } else if (typeof col4Raw === 'number') {
      mainQty = col4Raw;
    } else {
      const strVal = String(col4Raw).trim();
      const parsed = parseFloat(strVal);
      if (isNaN(parsed)) {
        // Only treat as feriado if it's a single letter from the known set — empty/zero cells are NOT feriado
        if (strVal.length === 1 && FERIADO_LETTERS.has(strVal.toUpperCase())) {
          // Include "FERIADO" keyword so formatCompactSummary can detect it in anomalies
          anomalies.push(`FERIADO: ${dayName} opción ${col2} tiene "${strVal}" en cantidad`);
        } else {
          anomalies.push(`Valor no numérico en ${dayName} opción ${col2}: "${strVal}"`);
        }
        mainQty = 0;
      } else {
        mainQty = parsed;
      }
    }

    const deptQuantities: Record<string, number> = {};
    for (let i = 0; i < departments.length; i++) {
      const colIdx = 5 + i;
      const val = row[colIdx];
      const num = parseFloat(String(val ?? '0'));
      deptQuantities[departments[i]] = isNaN(num) ? 0 : num;
    }

    // Validate dept sum vs main quantity (only when both have data)
    const deptSum = Object.values(deptQuantities).reduce((a, b) => a + b, 0);
    if (mainQty > 0 && deptSum > 0 && Math.abs(deptSum - mainQty) > 0.5) {
      anomalies.push(
        `Inconsistencia en ${dayName} ${col2}: depts (${deptSum}) ≠ principal (${mainQty})`
      );
    }

    options.push({
      code: col2.toUpperCase(),
      displayName: col3,
      quantities: { main: mainQty, departments: deptQuantities },
      anomalies,
    });
  }

  if (options.length === 0) return null;

  const calculatedTotal = options.reduce((sum, opt) => sum + opt.quantities.main, 0);

  if (totalFromSheet > 0 && Math.abs(calculatedTotal - totalFromSheet) > 0.5) {
    warnings.push(
      `${dayName}: total calculado (${calculatedTotal}) ≠ total de la hoja (${totalFromSheet})`
    );
  }

  return {
    dayOfWeek,
    dayName,
    options,
    // Prefer the value read from the TOTALES cell; fall back to calculated sum
    // if the sheet had no TOTALES row (shouldn't happen in well-formed files).
    totalUnits: totalFromSheet > 0 ? totalFromSheet : calculatedTotal,
  };
}
