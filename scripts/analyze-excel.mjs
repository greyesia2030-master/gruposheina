/**
 * Diagnostic script — analiza la estructura real del Excel de Sheina.
 * Uso: node scripts/analyze-excel.mjs path/al/archivo.xlsx
 * No committear este archivo.
 */

import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: node scripts/analyze-excel.mjs path/al/archivo.xlsx');
  process.exit(1);
}

const buffer = readFileSync(resolve(filePath));
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buffer);

console.log(`\n=== HOJAS (${workbook.worksheets.length}) ===`);
for (const sheet of workbook.worksheets) {
  console.log(`  - "${sheet.name}" | rowCount: ${sheet.rowCount} | actualRowCount: ${sheet.actualRowCount} | colCount: ${sheet.columnCount}`);
}

for (const sheet of workbook.worksheets) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`HOJA: "${sheet.name}"`);
  console.log('='.repeat(80));

  const rowCount = sheet.actualRowCount ?? sheet.rowCount;
  const colCount = Math.max(sheet.columnCount, 12);

  for (let r = 1; r <= Math.min(rowCount, 80); r++) {
    const row = sheet.getRow(r);
    const cells = [];
    for (let c = 1; c <= colCount; c++) {
      const raw = row.getCell(c).value;
      let val = null;
      if (raw === null || raw === undefined) {
        val = null;
      } else if (typeof raw === 'number' || typeof raw === 'string' || typeof raw === 'boolean') {
        val = raw;
      } else if (raw instanceof Date) {
        val = raw.toISOString().slice(0, 10);
      } else if (typeof raw === 'object') {
        if ('richText' in raw) val = raw.richText.map(t => t.text).join('');
        else if ('text' in raw) val = raw.text;
        else if ('result' in raw) val = raw.result;
        else if ('error' in raw) val = `#ERR`;
      }
      cells.push(val);
    }

    const hasData = cells.some(c => c !== null && c !== '' && c !== undefined);
    if (hasData) {
      const formatted = cells.map((v, i) => `[${i}]=${JSON.stringify(v)}`).join('  ');
      console.log(`  R${String(r).padStart(3)}: ${formatted}`);
    }
  }

  if (rowCount > 80) {
    console.log(`  ... (${rowCount - 80} filas más omitidas)`);
  }
}
