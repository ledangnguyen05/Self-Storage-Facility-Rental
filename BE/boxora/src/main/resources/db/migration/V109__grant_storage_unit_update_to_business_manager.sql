-- Grant STORAGE_UNIT_UPDATE and STORAGE_UNIT_CREATE to BUSINESS_MANAGER so Business Manager can manage and toggle maintenance of storage units
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Cấp quyền cập nhật trạng thái bảo trì ngăn kho cho Quản lý kinh doanh (BUSINESS_MANAGER)'
FROM roles r, permissions p
WHERE r.name = 'BUSINESS_MANAGER'
  AND p.name IN ('STORAGE_UNIT_UPDATE', 'STORAGE_UNIT_CREATE')
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

