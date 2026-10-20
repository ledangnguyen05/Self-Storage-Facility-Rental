-- =========================================================================
-- V49: Enhance Contract Renewal Lifecycle, Permissions and Audit Tracking
-- =========================================================================

-- 1. Add approval, review, cashier payment and digital signature fields to contract_renewals
ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS reviewed_by_id UUID REFERENCES users(id);

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS receipt_voucher_code VARCHAR(100);

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS cashier_staff_id UUID REFERENCES users(id);

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS signature_data TEXT;

-- 2. Add RENEWAL_APPROVE permission into permissions table
INSERT INTO permissions (id, created_at, updated_at, name, permission_group, description, is_active)
VALUES (
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'RENEWAL_APPROVE',
    'RENEWAL',
    'Approve or reject contract renewal requests within facility or chain-wide',
    TRUE
)
ON CONFLICT (name) DO NOTHING;

-- 3. Grant RENEWAL_VIEW and RENEWAL_CREATE to STAFF
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE, 'Staff renewal management permissions'
FROM roles r, permissions p
WHERE r.name = 'STAFF'
  AND p.name IN ('RENEWAL_VIEW', 'RENEWAL_CREATE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Grant RENEWAL_VIEW, RENEWAL_CREATE and RENEWAL_APPROVE to BUSINESS_MANAGER
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE, 'Business manager chain-wide renewal permissions'
FROM roles r, permissions p
WHERE r.name = 'BUSINESS_MANAGER'
  AND p.name IN ('RENEWAL_VIEW', 'RENEWAL_CREATE', 'RENEWAL_APPROVE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Grant RENEWAL_APPROVE to FACILITY_MANAGER and ADMIN
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE, 'Facility manager and Admin renewal approval permission'
FROM roles r, permissions p
WHERE r.name IN ('FACILITY_MANAGER', 'ADMIN')
  AND p.name = 'RENEWAL_APPROVE'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 6. Seed sample renewal records for demonstration and testing across statuses
-- CTR-2026-1001 (customer: Tran Minh Tuan) -> COMPLETED renewal
INSERT INTO contract_renewals (
    id, created_at, updated_at, contract_id, payment_id,
    old_end_date, new_end_date, cycle_months, renewal_fee, status,
    signed_document_url, signed_at, payment_method, receipt_voucher_code, paid_at, notes
)
VALUES (
    'aa110000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '14 days',
    'd0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000013',
    '2026-09-01',
    '2026-12-01',
    3,
    3750000.00,
    'COMPLETED',
    'https://boxora.vn/contracts/renewals/RNW-2026-1001.pdf',
    NOW() - INTERVAL '14 days',
    'VNPAY',
    'TXN-2026-1001-REN3M',
    NOW() - INTERVAL '14 days',
    'Gia hạn hợp đồng định kỳ 3 tháng đã hoàn tất ký và thanh toán'
)
ON CONFLICT (id) DO NOTHING;

-- CTR-2026-1002 (customer: Le Thi Hoang Yen) -> PENDING_PAYMENT
INSERT INTO contract_renewals (
    id, created_at, updated_at, contract_id, payment_id,
    old_end_date, new_end_date, cycle_months, renewal_fee, status,
    signed_document_url, signed_at, notes
)
VALUES (
    'aa110000-0000-0000-0000-000000000002',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day',
    'd0000000-0000-0000-0000-000000000002',
    NULL,
    '2026-10-10',
    '2027-01-10',
    3,
    14400000.00,
    'PENDING_PAYMENT',
    'https://boxora.vn/contracts/renewals/RNW-2026-1002.pdf',
    NOW() - INTERVAL '1 day',
    'Khách đã ký phụ lục gia hạn qua DocuSeal, đang chờ thanh toán tiền thuê kỳ mới'
)
ON CONFLICT (id) DO NOTHING;

-- CTR-2026-1003 (customer: Hoang Nam Anh) -> PENDING_SIGNATURE
INSERT INTO contract_renewals (
    id, created_at, updated_at, contract_id, payment_id,
    old_end_date, new_end_date, cycle_months, renewal_fee, status,
    docuseal_submission_id, docuseal_submitter_slug, notes
)
VALUES (
    'aa110000-0000-0000-0000-000000000003',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '5 hours',
    'd0000000-0000-0000-0000-000000000003',
    NULL,
    '2026-11-15',
    '2027-02-15',
    3,
    7200000.00,
    'PENDING_SIGNATURE',
    891234,
    'mock-rnw-1003-sig',
    'Đã gửi liên kết ký phụ lục gia hạn DocuSeal đến email khách hàng'
)
ON CONFLICT (id) DO NOTHING;

-- CTR-2026-1004 (customer: Pham Mai Phuong) -> PENDING_REVIEW
INSERT INTO contract_renewals (
    id, created_at, updated_at, contract_id, payment_id,
    old_end_date, new_end_date, cycle_months, renewal_fee, status,
    notes
)
VALUES (
    'aa110000-0000-0000-0000-000000000004',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    'd0000000-0000-0000-0000-000000000004',
    NULL,
    '2026-12-01',
    '2027-06-01',
    6,
    7500000.00,
    'PENDING_REVIEW',
    'Khách hàng đề nghị gia hạn sớm trước hạn 6 tháng - Chờ Quản lý cơ sở phê duyệt ngoại lệ'
)
ON CONFLICT (id) DO NOTHING;

-- CTR-2026-1005 (customer: Vu Duc Thang) -> REJECTED
INSERT INTO contract_renewals (
    id, created_at, updated_at, contract_id, payment_id,
    old_end_date, new_end_date, cycle_months, renewal_fee, status,
    reviewed_by_id, reviewed_at, rejection_reason, notes
)
VALUES (
    'aa110000-0000-0000-0000-000000000005',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days',
    'd0000000-0000-0000-0000-000000000005',
    NULL,
    '2026-12-15',
    '2027-12-15',
    12,
    57600000.00,
    'REJECTED',
    'e0000000-0000-0000-0000-000000000002',
    NOW() - INTERVAL '2 days',
    'Khu vực kho thuộc diện bảo trì hệ thống điều hòa định kỳ, không thể gia hạn 12 tháng tại ô kho này. Đã tư vấn khách đổi kho.',
    'Từ chối theo kế hoạch bảo trì kỹ thuật cơ sở'
)
ON CONFLICT (id) DO NOTHING;
