-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428142905_i1_seed_inventory_lots_for_demo_v3
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Seed de 22 lotes para demo

INSERT INTO inventory_lots (item_id, site_id, lot_code, quantity_initial, quantity_remaining, unit, cost_per_unit, received_at, expires_at)
VALUES
('c0000000-0000-0000-0000-000000000001', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-CARNE-001', 15, 15, 'kg', 5400, now() - interval '8 days', CURRENT_DATE + 5),
('c0000000-0000-0000-0000-000000000001', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-CARNE-002', 10, 10, 'kg', 5500, now() - interval '2 days', CURRENT_DATE + 7),
('c0000000-0000-0000-0000-000000000002', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-POLLO-001', 8, 8, 'kg', 3100, now() - interval '6 days', CURRENT_DATE + 3),
('c0000000-0000-0000-0000-000000000002', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-POLLO-002', 6, 6, 'kg', 3200, now() - interval '1 day', CURRENT_DATE + 5),
('c0000000-0000-0000-0000-000000000003', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-MUZZA-001', 8, 8, 'kg', 4700, now() - interval '7 days', CURRENT_DATE + 14),
('c0000000-0000-0000-0000-000000000003', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-MUZZA-002', 5, 5, 'kg', 4800, now() - interval '2 days', CURRENT_DATE + 21),
('c0000000-0000-0000-0000-000000000004', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-HARI-001', 25, 25, 'kg', 600, now() - interval '15 days', CURRENT_DATE + 60),
('c0000000-0000-0000-0000-000000000004', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-HARI-002', 20, 20, 'kg', 650, now() - interval '3 days', CURRENT_DATE + 90),
('c0000000-0000-0000-0000-000000000005', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-HUEV-001', 120, 120, 'un', 110, now() - interval '5 days', CURRENT_DATE + 14),
('c0000000-0000-0000-0000-000000000005', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-HUEV-002', 100, 100, 'un', 120, now() - interval '1 day', CURRENT_DATE + 21),
('c0000000-0000-0000-0000-000000000006', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-TOMA-001', 10, 10, 'kg', 1100, now() - interval '4 days', CURRENT_DATE + 6),
('c0000000-0000-0000-0000-000000000006', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-TOMA-002', 8, 8, 'kg', 1200, now() - interval '1 day', CURRENT_DATE + 8),
('c0000000-0000-0000-0000-000000000007', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-LECH-001', 15, 15, 'un', 580, now() - interval '3 days', CURRENT_DATE + 4),
('c0000000-0000-0000-0000-000000000007', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-LECH-002', 12, 12, 'un', 600, now() - interval '1 day', CURRENT_DATE + 6),
('c0000000-0000-0000-0000-000000000008', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-PAPA-001', 20, 20, 'kg', 750, now() - interval '10 days', CURRENT_DATE + 30),
('c0000000-0000-0000-0000-000000000008', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-PAPA-002', 15, 15, 'kg', 800, now() - interval '2 days', CURRENT_DATE + 45),
('c0000000-0000-0000-0000-000000000010', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-JAMO-001', 5, 5, 'kg', 6300, now() - interval '6 days', CURRENT_DATE + 14),
('c0000000-0000-0000-0000-000000000010', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-JAMO-002', 4, 4, 'kg', 6500, now() - interval '2 days', CURRENT_DATE + 18),
('c0000000-0000-0000-0000-000000000011', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-QUES-001', 1.5, 1.5, 'kg', 5100, now() - interval '4 days', CURRENT_DATE + 14),
('c0000000-0000-0000-0000-000000000011', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-QUES-002', 1, 1, 'kg', 5200, now() - interval '1 day', CURRENT_DATE + 21),
('c0000000-0000-0000-0000-000000000015', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-ACEI-001', 8, 8, 'l', 1050, now() - interval '12 days', CURRENT_DATE + 180),
('c0000000-0000-0000-0000-000000000015', '0d366122-9daa-4650-bab4-3fe2c3b31cc9', 'LOT-ACEI-002', 6, 6, 'l', 1100, now() - interval '3 days', CURRENT_DATE + 200);
