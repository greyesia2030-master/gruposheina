import * as XLSX from 'xlsx';
import type { ParseResult, ParsedWeek, ParsedDay, ParsedOption } from './types';

const DAY_NAMES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  'LUNES': 1,
  'MARTES': 2,
  'MIERCOLES': 3,
  'MIÉRCOLES': 3,
  'JUEVES': 4,
  'VIERNES': 5,
};

const FERIADO_LETTERS = new Set(['F', 'E', 'R', 'I', 'A', 'D', 'O']);

/**
 * Parsea un archivo Excel con el formato específico de Grupo Sheina.
 * Detecta semanas, días, opciones de menú y anomalías.
 */
export function parseSheinaExcel(buffer: Buffer): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const weeks: ParsedWeek[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { weeks: [], errors: ['No se pudo leer el archivo Excel. Verificá que el formato sea .xlsx o .xls'], warnings: [] };
  }

  if (workbook.SheetNames.length === 0) {
    return { weeks: [], errors: ['El archivo Excel no contiene hojas'], warnings: [] };
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rows.length < 3) {
      warnings.push(`Hoja "${sheetName}" tiene muy pocas filas, se omite`);
      continue;
    }

    const week = parseSheet(sheetName, rows, errors, warnings);
    if (week) {
      weeks.push(week);
    }
  }

  if (weeks.length === 0 && errors.length === 0) {
    errors.push('No se encontraron datos de pedidos en ninguna hoja');
  }

  return { weeks, errors, warnings };
}

function parseSheet(
  sheetName: string,
  rows: (string | number | null)[][],
  errors: string[],
  warnings: string[]
): ParsedWeek | null {
  // Detectar nombre de semana del encabezado de la hoja o primera fila
  const weekLabel = detectWeekLabel(sheetName, rows);

  // Detectar nombres de departamentos del encabezado
  const departments = detectDepartments(rows);

  // Agrupar filas por día
  const days: ParsedDay[] = [];
  let currentDay: { name: string; dayOfWeek: 1 | 2 | 3 | 4 | 5; rows: (string | number | null)[][] } | null = null;

  for (const row of rows) {
    const col1 = String(row[1] ?? '').trim().toUpperCase();

    // Detectar inicio de día
    if (DAY_NAMES[col1] !== undefined) {
      // Procesar día anterior si existe
      if (currentDay) {
        const day = parseDayRows(currentDay.name, currentDay.dayOfWeek, currentDay.rows, departments, warnings);
        if (day) days.push(day);
      }
      currentDay = { name: col1, dayOfWeek: DAY_NAMES[col1], rows: [row] };
    } else if (currentDay) {
      currentDay.rows.push(row);
    }
  }

  // Procesar último día
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

function detectWeekLabel(sheetName: string, rows: (string | number | null)[][]): string {
  // Buscar en la primera columna de las primeras filas
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const val = String(rows[i]?.[0] ?? '').trim();
    if (val && /semana/i.test(val)) return val;
    // Formato "DD.MM AL DD.MM" o "DD-MM AL DD-MM"
    if (/\d{1,2}[.\-/]\d{1,2}\s*(al|AL)\s*\d{1,2}[.\-/]\d{1,2}/.test(val)) return val;
  }
  // Fallback: usar nombre de la hoja
  return sheetName;
}

function detectDepartments(rows: (string | number | null)[][]): string[] {
  // Buscar fila de encabezado con nombres de departamentos en columnas 5-9
  const defaults = ['adm', 'vtas', 'diet', 'log', 'otros'];

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length < 6) continue;

    // Verificar si las columnas 5+ contienen texto que parece nombres de departamentos
    const candidates = [];
    for (let col = 5; col < Math.min(10, row.length); col++) {
      const val = String(row[col] ?? '').trim().toLowerCase();
      if (val && !/^\d+$/.test(val)) {
        candidates.push(val);
      }
    }
    if (candidates.length >= 3) return candidates;
  }

  return defaults;
}

function parseDayRows(
  dayName: string,
  dayOfWeek: 1 | 2 | 3 | 4 | 5,
  rows: (string | number | null)[][],
  departments: string[],
  warnings: string[]
): ParsedDay | null {
  const options: ParsedOption[] = [];
  let totalFromSheet = 0;

  for (const row of rows) {
    const col2 = String(row[2] ?? '').trim(); // Código de opción
    const col3 = String(row[3] ?? '').trim(); // Nombre del plato
    const col4Raw = row[4];                   // Cantidad principal

    // Detectar fila de TOTALES
    if (/totales?/i.test(col3)) {
      const total = parseFloat(String(col4Raw ?? '0'));
      if (!isNaN(total)) totalFromSheet = total;
      continue;
    }

    // Omitir filas sin código de opción
    if (!col2 || !col3) continue;

    const anomalies: string[] = [];
    let mainQty = 0;

    // Parsear cantidad principal
    if (col4Raw === null || col4Raw === undefined || col4Raw === '') {
      mainQty = 0;
    } else if (typeof col4Raw === 'number') {
      mainQty = col4Raw;
    } else {
      const strVal = String(col4Raw).trim();
      const parsed = parseFloat(strVal);
      if (isNaN(parsed)) {
        // Verificar si es letra de feriado
        if (strVal.length === 1 && FERIADO_LETTERS.has(strVal.toUpperCase())) {
          anomalies.push(`Posible feriado o pendiente: columna cantidad tiene "${strVal}"`);
        } else {
          anomalies.push(`Valor no numérico en cantidad: "${strVal}"`);
        }
        mainQty = 0;
      } else {
        mainQty = parsed;
      }
    }

    // Parsear cantidades por departamento
    const deptQuantities: Record<string, number> = {};
    for (let i = 0; i < departments.length; i++) {
      const colIdx = 5 + i;
      const val = row[colIdx];
      const num = parseFloat(String(val ?? '0'));
      deptQuantities[departments[i]] = isNaN(num) ? 0 : num;
    }

    // Verificar consistencia: suma de departamentos vs cantidad principal
    const deptSum = Object.values(deptQuantities).reduce((a, b) => a + b, 0);
    if (mainQty > 0 && deptSum > 0 && Math.abs(deptSum - mainQty) > 0.5) {
      anomalies.push(`Inconsistencia: total departamentos (${deptSum}) ≠ cantidad principal (${mainQty})`);
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

  // Verificar total del día si existe en la hoja
  if (totalFromSheet > 0 && Math.abs(calculatedTotal - totalFromSheet) > 0.5) {
    warnings.push(
      `${dayName}: total calculado (${calculatedTotal}) ≠ total de la hoja (${totalFromSheet})`
    );
  }

  return {
    dayOfWeek,
    dayName,
    options,
    totalUnits: calculatedTotal,
  };
}
