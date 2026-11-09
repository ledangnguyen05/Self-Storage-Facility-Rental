-- V120: Phân quyền cho phép Business Manager và Facility Manager xóa kho và quản lý kho
-- Cấp quyền STORAGE_UNIT_DELETE cho BUSINESS_MANAGER và FACILITY_MANAGER
-- Cấp quyền UNIT_TYPE_DELETE cho FACILITY_MANAGER (BUSINESS_MANAGER đã có từ V95)
-- Cấp quyền STORAGE_UNIT_CREATE, STORAGE_UNIT_UPDATE cho BUSINESS_MANAGER (FACILITY_MANAGER đã có từ V95)

INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Cấp quyền quản lý và xóa kho cho Quản lý cơ sở và Quản lý kinh doanh'
FROM roles r, permissions p
WHERE r.name IN ('BUSINESS_MANAGER', 'FACILITY_MANAGER')
  AND p.name IN (
    'STORAGE_UNIT_DELETE',
    'STORAGE_UNIT_CREATE',
    'STORAGE_UNIT_UPDATE',
    'UNIT_TYPE_DELETE'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
