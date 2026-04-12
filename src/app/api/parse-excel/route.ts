import { NextRequest, NextResponse } from 'next/server';
import { parseSheinaExcel } from '@/lib/excel/sheina-parser';
import { parseExcelWithAI, generateOrderSummary } from '@/lib/ai/claude-client';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Leer archivo del form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Se requiere un archivo Excel (.xlsx o .xls)' },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.xlsx?$/i)) {
      return NextResponse.json(
        { error: 'Formato de archivo no soportado. Enviá un archivo .xlsx o .xls' },
        { status: 400 }
      );
    }

    // Parsear Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = parseSheinaExcel(buffer);

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { errors: parseResult.errors, warnings: parseResult.warnings },
        { status: 422 }
      );
    }

    // Validar con IA
    const validatedData = await parseExcelWithAI(parseResult);

    // Generar resumen para WhatsApp
    const summary = await generateOrderSummary(validatedData);

    return NextResponse.json({
      data: validatedData,
      summary,
      warnings: parseResult.warnings,
    });
  } catch (error) {
    console.error('Error procesando Excel:', error);
    return NextResponse.json(
      { error: 'Error interno al procesar el archivo' },
      { status: 500 }
    );
  }
}
