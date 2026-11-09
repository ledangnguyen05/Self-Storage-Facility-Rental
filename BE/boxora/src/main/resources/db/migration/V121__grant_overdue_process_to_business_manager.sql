-- V121: Phân quyền cho phép Business Manager và Facility Manager gửi thông báo nhắc nợ cước và xử lý quá hạn
-- Đảm bảo cả BUSINESS_MANAGER và FACILITY_MANAGER có quyền OVERDUE_VIEW và OVERDUE_PROCESS hoạt động
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Cấp quyền xem và xử lý gửi thông báo nợ cước quá hạn cho Business Manager và Facility Manager'
FROM roles r, permissions p
WHERE r.name IN ('BUSINESS_MANAGER', 'FACILITY_MANAGER')
  AND p.name IN (
    'OVERDUE_VIEW',
    'OVERDUE_PROCESS'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

