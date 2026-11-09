-- =========================================================================
-- V119: Standardize Unit Type Names to Vietnamese
-- =========================================================================

UPDATE unit_types
SET type_name = 'Vừa (phòng studio nhỏ)'
WHERE id = '10000000-0000-0000-0000-000000000002' OR type_name ILIKE '%Medium (Compact Studio)%';

UPDATE unit_types
SET type_name = 'Rất lớn (văn phòng thương mại)'
WHERE id = '10000000-0000-0000-0000-000000000004' OR type_name ILIKE '%Extra Large (Commercial Suite)%';

UPDATE unit_types
SET type_name = 'Mini (tủ cá nhân)'
WHERE id = '10000000-0000-0000-0000-000000000001' OR type_name ILIKE '%Small (Personal Locker)%';

UPDATE unit_types
SET type_name = 'Tiêu chuẩn (căn một phòng ngủ)'
WHERE id = '10000000-0000-0000-0000-000000000003' OR type_name ILIKE '%Large (Standard 1-Bedroom)%';

