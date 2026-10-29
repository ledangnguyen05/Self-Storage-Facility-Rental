-- V95: Standardize RBAC Role Permissions based on Boxora Enterprise Standard
-- 1. Khách hàng thuê kho (CUSTOMER)
-- 2. Nhân viên cơ sở (STAFF)
-- 3. Quản lý cơ sở (FACILITY_MANAGER)
-- 4. Quản lý vận hành kinh doanh (BUSINESS_MANAGER)
-- 5. Quản trị viên hệ thống (ADMIN)

-- Step 1: Deactivate all existing role_permissions for all 5 enterprise roles
UPDATE role_permissions
SET is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE role_id IN (
    SELECT id FROM roles WHERE name IN ('CUSTOMER', 'STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')
);

-- Step 2: 1. Khách hàng thuê kho (CUSTOMER)
-- - Xem cơ sở lưu trữ, loại kho, kích thước, giá thuê và kho trống
-- - Đặt thuê kho (chọn cơ sở, loại kho, ngày bắt đầu, thời hạn thuê)
-- - Thanh toán tiền đặt cọc, phí thuê, phí gia hạn hoặc phí phát sinh
-- - Thực hiện thủ tục nhận kho theo lịch hẹn đã đặt
-- - Quản lý một hoặc nhiều kho đang thuê
-- - Gửi yêu cầu hỗ trợ (kho, khóa, mã truy cập, thanh toán, hàng hóa)
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyền chuẩn hóa Khách hàng thuê kho (CUSTOMER)'
FROM roles r, permissions p
WHERE r.name = 'CUSTOMER'
  AND p.name IN (
    'FACILITY_VIEW',
    'UNIT_TYPE_VIEW',
    'STORAGE_UNIT_VIEW',
    'POLICY_VIEW',
    'BOOKING_CREATE',
    'BOOKING_VIEW',
    'BOOKING_CANCEL',
    'PAYMENT_CREATE',
    'PAYMENT_VIEW',
    'RENEWAL_CREATE',
    'HANDOVER_VIEW',
    'CONTRACT_VIEW',
    'ACCESS_CREDENTIAL_VIEW',
    'RENEWAL_VIEW',
    'SUPPORT_CREATE',
    'SUPPORT_VIEW',
    'SUPPORT_CLOSE'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Step 3: 2. Nhân viên cơ sở (STAFF)
-- - Kiểm tra thông tin đặt chỗ của khách khi đến nhận kho
-- - Hỗ trợ thủ tục nhận kho & bàn giao kho, khóa, thẻ/mã truy cập
-- - Cập nhật trạng thái kho sau bàn giao, quá trình sử dụng, sau trả kho, bảo trì
-- - Kiểm tra và xác nhận tình trạng kho khi khách trả lại
-- - Tiếp nhận & xử lý sự cố tại chỗ (mất chìa, lỗi mã, hư hỏng, hỗ trợ)
-- - Theo dõi danh sách khách cần nhận kho, trả kho hoặc cần hỗ trợ trong ngày
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyền chuẩn hóa Nhân viên cơ sở (STAFF)'
FROM roles r, permissions p
WHERE r.name = 'STAFF'
  AND p.name IN (
    'BOOKING_VIEW',
    'BOOKING_UPDATE',
    'HANDOVER_VIEW',
    'HANDOVER_CREATE',
    'ACCESS_CREDENTIAL_VIEW',
    'ACCESS_CREDENTIAL_UPDATE',
    'STORAGE_UNIT_VIEW',
    'STORAGE_UNIT_UPDATE',
    'SUPPORT_VIEW',
    'SUPPORT_UPDATE',
    'SUPPORT_CREATE',
    'MASTER_KEY_VIEW',
    'MASTER_KEY_OVERRIDE',
    'CONTRACT_VIEW',
    'STAFF_ASSIGNMENT_VIEW',
    'PAYMENT_VIEW',
    'FACILITY_VIEW',
    'UNIT_TYPE_VIEW',
    'RENEWAL_VIEW',
    'RENEWAL_CREATE'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Step 4: 3. Quản lý cơ sở (FACILITY_MANAGER)
-- - Quản lý các kho tại cơ sở (loại kho, kích thước, vị trí, giá, trạng thái)
-- - Chỉ định kho phù hợp cho khách hàng
-- - Theo dõi thông tin khách hàng, hợp đồng, thời hạn, thanh toán
-- - Quản lý bàn giao, trả kho, gia hạn, xử lý quá hạn, niêm phong, hoàn tiền cơ sở
-- - Phân công nhân viên cơ sở (bàn giao, kiểm tra, xử lý sự cố)
-- - Xem báo cáo cơ sở (kho trống, kho thuê, doanh thu, công suất, quá hạn)
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyền chuẩn hóa Quản lý cơ sở (FACILITY_MANAGER)'
FROM roles r, permissions p
WHERE r.name = 'FACILITY_MANAGER'
  AND p.name IN (
    'STORAGE_UNIT_VIEW',
    'STORAGE_UNIT_UPDATE',
    'STORAGE_UNIT_CREATE',
    'UNIT_TYPE_VIEW',
    'FACILITY_VIEW',
    'BOOKING_VIEW',
    'BOOKING_UPDATE',
    'BOOKING_CANCEL',
    'CONTRACT_VIEW',
    'CONTRACT_UPDATE',
    'PAYMENT_VIEW',
    'PAYMENT_CREATE',
    'ACCESS_CREDENTIAL_VIEW',
    'ACCESS_CREDENTIAL_UPDATE',
    'ACCESS_CREDENTIAL_REVOKE',
    'HANDOVER_VIEW',
    'HANDOVER_CREATE',
    'RENEWAL_VIEW',
    'RENEWAL_APPROVE',
    'OVERDUE_VIEW',
    'OVERDUE_PROCESS',
    'SEALING_VIEW',
    'SEALING_CREATE',
    'SEALING_UNSEAL',
    'REFUND_VIEW',
    'REFUND_APPROVE',
    'STAFF_ASSIGNMENT_VIEW',
    'STAFF_ASSIGNMENT_CREATE',
    'STAFF_ASSIGNMENT_DELETE',
    'SUPPORT_VIEW',
    'SUPPORT_UPDATE',
    'SUPPORT_ASSIGN',
    'SUPPORT_CLOSE',
    'SUPPORT_ESCALATE',
    'MASTER_KEY_VIEW',
    'MASTER_KEY_OVERRIDE',
    'REPORT_VIEW',
    'POLICY_VIEW',
    'FEE_VIEW'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Step 5: 4. Quản lý vận hành kinh doanh (BUSINESS_MANAGER)
-- - Quản lý danh sách tất cả các cơ sở lưu trữ trong toàn hệ thống
-- - Thiết lập các chính sách thuê chung (cọc, gia hạn, hủy, trả kho, quá hạn)
-- - Quản lý khung giá thuê, phụ phí, phí quá hạn, khuyến mãi, chiết khấu
-- - Theo dõi doanh thu, tỷ lệ sử dụng kho và hiệu suất từng cơ sở
-- - Xem và xuất các báo cáo trên toàn hệ thống
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyền chuẩn hóa Quản lý vận hành kinh doanh (BUSINESS_MANAGER)'
FROM roles r, permissions p
WHERE r.name = 'BUSINESS_MANAGER'
  AND p.name IN (
    'FACILITY_VIEW',
    'FACILITY_CREATE',
    'FACILITY_UPDATE',
    'FACILITY_DELETE',
    'UNIT_TYPE_VIEW',
    'UNIT_TYPE_CREATE',
    'UNIT_TYPE_UPDATE',
    'UNIT_TYPE_DELETE',
    'POLICY_VIEW',
    'POLICY_CREATE',
    'POLICY_UPDATE',
    'POLICY_DELETE',
    'OVERDUE_VIEW',
    'PRICE_ADJUST',
    'PRICE_HISTORY_VIEW',
    'FEE_VIEW',
    'FEE_CREATE',
    'FEE_UPDATE',
    'FEE_DELETE',
    'DISCOUNT_VIEW',
    'DISCOUNT_CREATE',
    'DISCOUNT_UPDATE',
    'DISCOUNT_DELETE',
    'REPORT_VIEW',
    'PAYMENT_VIEW',
    'STORAGE_UNIT_VIEW',
    'CONTRACT_VIEW',
    'BOOKING_VIEW',
    'HANDOVER_VIEW',
    'RENEWAL_VIEW',
    'SUPPORT_VIEW',
    'STAFF_ASSIGNMENT_VIEW'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Step 6: 5. Quản trị viên hệ thống (ADMIN)
-- - Quản lý tài khoản người dùng trong hệ thống
-- - Phân quyền cho các vai trò (CUSTOMER, STAFF, FACILITY_MANAGER, BUSINESS_MANAGER)
-- - Cấu hình quyền truy cập dữ liệu dựa trên vai trò và cơ sở
-- - Theo dõi lịch sử đăng nhập và nhật ký hoạt động
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyền chuẩn hóa Quản trị viên hệ thống (ADMIN)'
FROM roles r, permissions p
WHERE r.name = 'ADMIN'
  AND p.name IN (
    'USER_VIEW',
    'USER_CREATE',
    'USER_UPDATE',
    'USER_DELETE',
    'ROLE_VIEW',
    'ROLE_CREATE',
    'ROLE_UPDATE',
    'ROLE_DELETE',
    'ROLE_PERMISSION_VIEW',
    'ROLE_PERMISSION_ASSIGN',
    'ROLE_PERMISSION_REVOKE',
    'PERMISSION_VIEW',
    'PERMISSION_CREATE',
    'PERMISSION_UPDATE',
    'PERMISSION_DELETE',
    'ACTIVITY_LOG_VIEW',
    'LOGIN_HISTORY_VIEW'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

