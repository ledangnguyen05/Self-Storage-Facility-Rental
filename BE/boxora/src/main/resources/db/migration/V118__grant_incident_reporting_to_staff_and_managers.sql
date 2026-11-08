-- =========================================================================
-- V118: Grant Incident Reporting permission (SUPPORT_CREATE) to STAFF and FACILITY_MANAGER
-- Ensures both Staff and Facility Manager have full authorization to log/report incidents
-- =========================================================================

-- 1. Standardize description of SUPPORT_CREATE permission in permissions table
UPDATE permissions
SET description = 'Ghi nhận sự cố & tạo phiếu hỗ trợ (SUPPORT_CREATE)',
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'SUPPORT_CREATE';

-- 2. Activate SUPPORT_CREATE for FACILITY_MANAGER
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyền Ghi Nhận Sự Cố (SUPPORT_CREATE) cho Quản lý cơ sở (FACILITY_MANAGER)'
FROM roles r, permissions p
WHERE r.name = 'FACILITY_MANAGER' AND p.name = 'SUPPORT_CREATE'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- 3. Ensure SUPPORT_CREATE is active for STAFF
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyền Ghi Nhận Sự Cố (SUPPORT_CREATE) cho Nhân viên trực ca (STAFF)'
FROM roles r, permissions p
WHERE r.name = 'STAFF' AND p.name = 'SUPPORT_CREATE'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- 4. Also ensure SUPPORT_VIEW and SUPPORT_UPDATE are active for both roles
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyền xem và cập nhật sự cố cho STAFF & FACILITY_MANAGER'
FROM roles r, permissions p
WHERE r.name IN ('STAFF', 'FACILITY_MANAGER')
  AND p.name IN ('SUPPORT_VIEW', 'SUPPORT_UPDATE')
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

