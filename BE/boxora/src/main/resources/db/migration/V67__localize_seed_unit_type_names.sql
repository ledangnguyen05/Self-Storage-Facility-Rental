-- =========================================================================
-- V67: Vietnamese display names for the five seeded unit types
-- =========================================================================
-- The seed used English names ("Standard (1-Bedroom)", "Cold Storage (Climate Controlled 18-22°C)" ...). They appear in
-- the create-unit form, unit drawers, the customer catalogue and contracts of a Vietnamese product. Only rows that still
-- carry the exact seeded English name are renamed, and a rename is skipped when the Vietnamese name is already taken
-- (unit type names are unique, case-insensitively). Prices, areas and ids are untouched.

UPDATE unit_types
SET type_name = 'Mini (tủ cá nhân)', updated_at = NOW()
WHERE type_name = 'Mini (Personal Locker)'
  AND NOT EXISTS (SELECT 1 FROM unit_types t WHERE LOWER(t.type_name) = LOWER('Mini (tủ cá nhân)'));

UPDATE unit_types
SET type_name = 'Vừa (phòng studio nhỏ)', updated_at = NOW()
WHERE type_name = 'Medium (Compact Studio)'
  AND NOT EXISTS (SELECT 1 FROM unit_types t WHERE LOWER(t.type_name) = LOWER('Vừa (phòng studio nhỏ)'));

UPDATE unit_types
SET type_name = 'Tiêu chuẩn (căn một phòng ngủ)', updated_at = NOW()
WHERE type_name IN ('Standard (1-Bedroom)', 'Large (Standard 1-Bedroom)')
  AND NOT EXISTS (SELECT 1 FROM unit_types t WHERE LOWER(t.type_name) = LOWER('Tiêu chuẩn (căn một phòng ngủ)'));

UPDATE unit_types
SET type_name = 'Rất lớn (văn phòng thương mại)', updated_at = NOW()
WHERE type_name = 'Extra Large (Commercial Suite)'
  AND NOT EXISTS (SELECT 1 FROM unit_types t WHERE LOWER(t.type_name) = LOWER('Rất lớn (văn phòng thương mại)'));

UPDATE unit_types
SET type_name = 'Kho lạnh (kiểm soát nhiệt độ 18-22°C)', updated_at = NOW()
WHERE type_name IN ('Cold Storage (Climate Controlled 18-22°C)', 'Cold Storage (Climate Controlled 18-22C)')
  AND NOT EXISTS (SELECT 1 FROM unit_types t WHERE LOWER(t.type_name) = LOWER('Kho lạnh (kiểm soát nhiệt độ 18-22°C)'));
