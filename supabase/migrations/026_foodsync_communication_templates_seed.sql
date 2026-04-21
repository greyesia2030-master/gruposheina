-- FoodSync v2 — Migration 016 (local: 026)
-- 11 templates iniciales del Messaging Hub
-- Variables: {{cliente_nombre}}, {{semana}}, {{link_formulario}}, {{valid_until}},
--            {{numero_pedido}}, {{total_viandas}}, {{monto_total}}, {{link_dashboard}},
--            {{fecha_entrega}}, {{numero_factura}}, {{fecha_vencimiento}},
--            {{admin_nombre}}, {{seccion_nombre}}, {{member_id}}

INSERT INTO communication_templates (name, channel, category, subject, body, variables) VALUES

('pedido_link_formulario_wa', 'whatsapp', 'pedido_confirmacion', NULL,
'Hola {{cliente_nombre}}, te mandamos el link para que tu equipo arme el pedido de {{semana}}:

{{link_formulario}}

El link está activo hasta {{valid_until}}. Cualquier miembro de tu equipo puede entrar, elegir su sector, y cargar sus viandas.',
'["cliente_nombre","semana","link_formulario","valid_until"]'::jsonb),

('pedido_link_formulario_email', 'email', 'pedido_confirmacion',
'Link para armar el pedido de {{semana}}',
'Hola {{cliente_nombre}},

Te mandamos el link del formulario para que tu equipo arme el pedido de {{semana}}:

{{link_formulario}}

Cómo funciona:
- Cualquier miembro de tu equipo entra con el link
- Elige su sector o área
- Selecciona las viandas que corresponden a su parte

El link vence el {{valid_until}}.

Saludos,
Grupo Sheina',
'["cliente_nombre","semana","link_formulario","valid_until"]'::jsonb),

('seccion_cerrada_notif', 'whatsapp', 'pedido_modificacion', NULL,
'La sección *{{seccion_nombre}}* cerró su aporte al pedido. Total: {{total_viandas}} viandas.',
'["seccion_nombre","total_viandas"]'::jsonb),

('pedido_listo_confirmar_wa', 'whatsapp', 'pedido_confirmacion', NULL,
'Todas las secciones del pedido {{numero_pedido}} cerraron.

Total: {{total_viandas}} viandas
Monto: ${{monto_total}}

Revisá y confirmá: {{link_dashboard}}',
'["numero_pedido","total_viandas","monto_total","link_dashboard"]'::jsonb),

('pedido_listo_confirmar_email', 'email', 'pedido_confirmacion',
'Tu pedido {{numero_pedido}} está listo para confirmar',
'Hola {{cliente_nombre}},

Todas las secciones del pedido {{numero_pedido}} cerraron sus aportes.

Resumen:
- Total viandas: {{total_viandas}}
- Monto estimado: ${{monto_total}}
- Entrega: {{fecha_entrega}}

Ingresá al panel para revisar el detalle y confirmar:
{{link_dashboard}}

Saludos,
Grupo Sheina',
'["cliente_nombre","numero_pedido","total_viandas","monto_total","fecha_entrega","link_dashboard"]'::jsonb),

('pedido_confirmado', 'whatsapp', 'pedido_confirmacion', NULL,
'Tu pedido {{numero_pedido}} quedó confirmado.

Lo empezamos a producir. Te avisamos cuando esté listo para entregar.',
'["numero_pedido"]'::jsonb),

('factura_enviada', 'email', 'facturacion',
'Factura {{numero_factura}}',
'Hola {{cliente_nombre}},

Adjuntamos la factura {{numero_factura}} por ${{monto_total}} correspondiente al pedido {{numero_pedido}}.

Vencimiento: {{fecha_vencimiento}}

Saludos,
Grupo Sheina',
'["cliente_nombre","numero_factura","monto_total","numero_pedido","fecha_vencimiento"]'::jsonb),

('recordatorio_pago', 'whatsapp', 'recordatorio_pago', NULL,
'Hola {{cliente_nombre}}, te recordamos que la factura {{numero_factura}} por ${{monto_total}} vence el {{fecha_vencimiento}}.',
'["cliente_nombre","numero_factura","monto_total","fecha_vencimiento"]'::jsonb),

('modificacion_sugerida', 'whatsapp', 'pedido_modificacion', NULL,
'Hola {{cliente_nombre}}, {{admin_nombre}} de Grupo Sheina sugiere una modificación al pedido {{numero_pedido}}. Revisalo acá: {{link_dashboard}}',
'["cliente_nombre","admin_nombre","numero_pedido","link_dashboard"]'::jsonb),

('soporte_recibido', 'whatsapp', 'soporte', NULL,
'Gracias por tu mensaje. Tu consulta quedó registrada. Un miembro del equipo te contesta en breve.',
'[]'::jsonb),

('entrega_en_camino', 'whatsapp', 'entrega_notificacion', NULL,
'Tu pedido {{numero_pedido}} está en camino. Ruta estimada: llega en los próximos 30 a 60 minutos.',
'["numero_pedido"]'::jsonb)

ON CONFLICT (name, channel) DO NOTHING;
