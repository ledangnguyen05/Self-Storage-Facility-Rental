-- =========================================================================
-- V6: CREATE 5 NEW SPRINT TABLES & SEED DATA
-- 1. storage_unit_price_histories (Lịch sử biến động giá kho - BR-RULE-011)
-- 2. fee_types (Danh mục các loại phí phụ trợ / phạt vi phạm)
-- 3. discounts (Chính sách chiết khấu kỳ hạn & Voucher khuyến mãi)
-- 4. staff_assignments (Phân công ca trực & khu vực nhân viên nội bộ)
-- 5. sealing_records (Biên bản niêm phong tài sản kho quá hạn - BR-RULE-012)
-- =========================================================================

-- 0. Bổ sung cột price_per_month vào bảng storage_units
ALTER TABLE storage_units
    ADD COLUMN IF NOT EXISTS price_per_month NUMERIC(12, 2);

-- =========================================================================
-- 1. TABLE: storage_unit_price_histories (BR-RULE-011)
-- =========================================================================
CREATE TABLE IF NOT EXISTS storage_unit_price_histories
(
    id              UUID          NOT NULL,
    created_at      TIMESTAMP     NOT NULL,
    updated_at      TIMESTAMP     NOT NULL,
    storage_unit_id UUID          NOT NULL,
    unit_type_id    UUID,
    old_price       NUMERIC(12,2),
    new_price       NUMERIC(12,2) NOT NULL,
    effective_from  TIMESTAMP     NOT NULL,
    reason          VARCHAR(500)  NOT NULL,
    changed_by_id   UUID          NOT NULL,

    CONSTRAINT pk_storage_unit_price_histories PRIMARY KEY (id),

    CONSTRAINT fk_suph_storage_unit
        FOREIGN KEY (storage_unit_id)
        REFERENCES storage_units(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_suph_unit_type
        FOREIGN KEY (unit_type_id)
        REFERENCES unit_types(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_suph_changed_by
        FOREIGN KEY (changed_by_id)
        REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_suph_storage_unit_id ON storage_unit_price_histories(storage_unit_id);
CREATE INDEX IF NOT EXISTS idx_suph_effective_from ON storage_unit_price_histories(effective_from);
CREATE INDEX IF NOT EXISTS idx_suph_changed_by_id ON storage_unit_price_histories(changed_by_id);

-- =========================================================================
-- 2. TABLE: fee_types (Quản lý các loại phụ phí và phí phạt)
-- =========================================================================
CREATE TABLE IF NOT EXISTS fee_types
(
    id              UUID          NOT NULL,
    created_at      TIMESTAMP     NOT NULL,
    updated_at      TIMESTAMP     NOT NULL,
    code            VARCHAR(50)   NOT NULL,
    name            VARCHAR(150)  NOT NULL,
    description     VARCHAR(255),
    default_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    fee_category    VARCHAR(50)   NOT NULL,
    is_recurring    BOOLEAN       NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_fee_types PRIMARY KEY (id),
    CONSTRAINT uc_fee_types_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_fee_types_code ON fee_types(code);
CREATE INDEX IF NOT EXISTS idx_fee_types_category ON fee_types(fee_category);

-- =========================================================================
-- 3. TABLE: discounts (Chính sách giảm giá / Voucher)
-- =========================================================================
CREATE TABLE IF NOT EXISTS discounts
(
    id                  UUID          NOT NULL,
    created_at          TIMESTAMP     NOT NULL,
    updated_at          TIMESTAMP     NOT NULL,
    code                VARCHAR(50)   NOT NULL,
    name                VARCHAR(150)  NOT NULL,
    description         VARCHAR(255),
    discount_type       VARCHAR(30)   NOT NULL, -- PERCENTAGE, FIXED_AMOUNT, TENURE_CYCLE
    discount_value      NUMERIC(12,2) NOT NULL,
    min_rental_months   INTEGER       NOT NULL DEFAULT 1,
    max_discount_amount NUMERIC(12,2),
    start_date          DATE          NOT NULL,
    end_date            DATE,
    usage_limit         INTEGER,
    used_count          INTEGER       NOT NULL DEFAULT 0,
    facility_id         UUID,
    is_active           BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_discounts PRIMARY KEY (id),
    CONSTRAINT uc_discounts_code UNIQUE (code),
    CONSTRAINT fk_discounts_facility
        FOREIGN KEY (facility_id)
        REFERENCES facilities(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);
CREATE INDEX IF NOT EXISTS idx_discounts_facility_id ON discounts(facility_id);

-- =========================================================================
-- 4. TABLE: staff_assignments (Phân công nhân viên theo cơ sở / ca trực)
-- =========================================================================
CREATE TABLE IF NOT EXISTS staff_assignments
(
    id              UUID         NOT NULL,
    created_at      TIMESTAMP    NOT NULL,
    updated_at      TIMESTAMP    NOT NULL,
    staff_id        UUID         NOT NULL,
    facility_id     UUID         NOT NULL,
    assigned_date   DATE         NOT NULL,
    shift           VARCHAR(30)  NOT NULL, -- MORNING, AFTERNOON, NIGHT, FULL_DAY
    assigned_zone   VARCHAR(50),           -- Zone A, Zone B, Floor 1
    role_in_shift   VARCHAR(50)  NOT NULL DEFAULT 'PRIMARY_STAFF', -- PRIMARY_STAFF, BACKUP_STAFF, SUPERVISOR
    status          VARCHAR(30)  NOT NULL DEFAULT 'ASSIGNED',      -- ASSIGNED, CHECKED_IN, COMPLETED, ABSENT
    assigned_by_id  UUID,
    notes           TEXT,

    CONSTRAINT pk_staff_assignments PRIMARY KEY (id),

    CONSTRAINT fk_sa_staff
        FOREIGN KEY (staff_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sa_facility
        FOREIGN KEY (facility_id)
        REFERENCES facilities(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sa_assigned_by
        FOREIGN KEY (assigned_by_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sa_facility_date ON staff_assignments(facility_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_sa_staff_date ON staff_assignments(staff_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_sa_status ON staff_assignments(status);

-- =========================================================================
-- 5. TABLE: sealing_records (Niêm phong kho quá hạn thanh toán BR-RULE-012)
-- =========================================================================
CREATE TABLE IF NOT EXISTS sealing_records
(
    id                  UUID         NOT NULL,
    created_at          TIMESTAMP    NOT NULL,
    updated_at          TIMESTAMP    NOT NULL,
    storage_unit_id     UUID         NOT NULL,
    contract_id         UUID,
    facility_id         UUID         NOT NULL,
    seal_tag_number     VARCHAR(50)  NOT NULL,
    reason              VARCHAR(500) NOT NULL,
    sealed_at           TIMESTAMP    NOT NULL,
    sealed_by_id        UUID         NOT NULL,
    witness_id          UUID         NOT NULL,
    status              VARCHAR(30)  NOT NULL DEFAULT 'SEALED', -- SEALED, UNSEALED, DISPOSED
    unsealed_at         TIMESTAMP,
    unsealed_by_id      UUID,
    unseal_reason       VARCHAR(500),
    photo_evidence_url  VARCHAR(500),
    notes               TEXT,

    CONSTRAINT pk_sealing_records PRIMARY KEY (id),
    CONSTRAINT uc_sealing_records_tag UNIQUE (seal_tag_number),

    CONSTRAINT fk_sr_storage_unit
        FOREIGN KEY (storage_unit_id)
        REFERENCES storage_units(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sr_contract
        FOREIGN KEY (contract_id)
        REFERENCES rental_contracts(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_sr_facility
        FOREIGN KEY (facility_id)
        REFERENCES facilities(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sr_sealed_by
        FOREIGN KEY (sealed_by_id)
        REFERENCES users(id),

    CONSTRAINT fk_sr_witness
        FOREIGN KEY (witness_id)
        REFERENCES users(id),

    CONSTRAINT fk_sr_unsealed_by
        FOREIGN KEY (unsealed_by_id)
        REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sr_storage_unit ON sealing_records(storage_unit_id);
CREATE INDEX IF NOT EXISTS idx_sr_facility ON sealing_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_sr_status ON sealing_records(status);

-- =========================================================================
-- 6. PERMISSIONS & ROLE PERMISSIONS
-- =========================================================================
INSERT INTO permissions (id, created_at, updated_at, name, permission_group, description, is_active)
VALUES
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PRICE_HISTORY_VIEW', 'STORAGE_UNIT', 'Xem lịch sử thay đổi giá kho (BR-RULE-011)', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PRICE_ADJUST', 'STORAGE_UNIT', 'Điều chỉnh giá thuê kho và ghi nhận lịch sử (BR-RULE-011)', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_VIEW', 'FEE', 'Xem danh mục các loại phí phụ trợ', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_CREATE', 'FEE', 'Tạo mới loại phí', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_UPDATE', 'FEE', 'Cập nhật loại phí', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_DELETE', 'FEE', 'Xóa hoặc vô hiệu hóa loại phí', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SEALING_VIEW', 'OVERDUE', 'Xem biên bản niêm phong kho (BR-RULE-012)', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SEALING_CREATE', 'OVERDUE', 'Lập biên bản niêm phong kho quá hạn (BR-RULE-012)', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SEALING_UNSEAL', 'OVERDUE', 'Mở niêm phong kho sau thanh toán (BR-RULE-012)', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Phân quyền cho ADMIN (tất cả quyền mới)
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
       r.id, p.id, TRUE, 'Admin full access to new sprint permissions'
FROM roles r, permissions p
WHERE r.name = 'ADMIN'
  AND p.name IN (
    'PRICE_HISTORY_VIEW', 'PRICE_ADJUST',
    'FEE_VIEW', 'FEE_CREATE', 'FEE_UPDATE', 'FEE_DELETE',
    'SEALING_VIEW', 'SEALING_CREATE', 'SEALING_UNSEAL'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Phân quyền cho BUSINESS_MANAGER
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
       r.id, p.id, TRUE, 'Business manager access to pricing, fee and discounts'
FROM roles r, permissions p
WHERE r.name = 'BUSINESS_MANAGER'
  AND p.name IN (
    'PRICE_HISTORY_VIEW', 'PRICE_ADJUST',
    'FEE_VIEW', 'FEE_CREATE', 'FEE_UPDATE',
    'SEALING_VIEW', 'SEALING_CREATE', 'SEALING_UNSEAL'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Phân quyền cho FACILITY_MANAGER
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
       r.id, p.id, TRUE, 'Facility manager access to operations, assignments and sealing'
FROM roles r, permissions p
WHERE r.name = 'FACILITY_MANAGER'
  AND p.name IN (
    'PRICE_HISTORY_VIEW', 'PRICE_ADJUST',
    'FEE_VIEW',
    'SEALING_VIEW', 'SEALING_CREATE', 'SEALING_UNSEAL'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Phân quyền cho STAFF
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
       r.id, p.id, TRUE, 'Staff view pricing and sealing records'
FROM roles r, permissions p
WHERE r.name = 'STAFF'
  AND p.name IN ('PRICE_HISTORY_VIEW', 'FEE_VIEW', 'SEALING_VIEW')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =========================================================================
-- 7. SEED DATA: 5 NEW TABLES
-- =========================================================================

-- 7.1 Seed fee_types
INSERT INTO fee_types (id, created_at, updated_at, code, name, description, default_amount, fee_category, is_recurring, is_active)
VALUES
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_LATE_DAILY', 'Phí phạt quá hạn theo ngày', 'Phạt quá hạn thanh toán tiền thuê theo quy định hợp đồng', 50000.00, 'LATE_PENALTY', FALSE, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_OVERDUE_LOCK', 'Phí kích hoạt lại quyền truy cập', 'Phí mở khóa truy cập IoT sau khi bị khóa do chậm thanh toán', 100000.00, 'OVERDUE_STORAGE', FALSE, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_SEAL_OPERATION', 'Phí xử lý niêm phong kho', 'Chi phí niêm phong và bảo toàn tài sản vi phạm quá hạn (+7 ngày theo BR-RULE-012)', 200000.00, 'OVERDUE_STORAGE', FALSE, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_CLEAN_STANDARD', 'Phí vệ sinh kho cơ bản', 'Áp dụng khi khách trả kho không dọn sạch rác hoặc bụi bẩn thông thường', 150000.00, 'CLEANING', FALSE, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_CLEAN_HEAVY', 'Phí tẩy rửa mùi hôi & hóa chất', 'Áp dụng khi kho bị bám bẩn nặng, dầu mỡ, hóa chất hoặc mùi khó chịu', 350000.00, 'CLEANING', FALSE, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_SMARTLOCK_KEY', 'Phí thay mới ổ khóa thông minh IoT', 'Bồi thường khi khách làm hỏng hoặc mất thiết bị khóa thông minh', 500000.00, 'KEY_REPLACEMENT', FALSE, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FEE_INSURANCE_BASIC', 'Phí bảo hiểm phòng chống cháy nổ cơ bản', 'Bảo hiểm tài sản lưu trữ tiêu chuẩn trị giá bồi thường đến 50.000.000 đ', 50000.00, 'INSURANCE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 7.2 Seed discounts
INSERT INTO discounts (id, created_at, updated_at, code, name, description, discount_type, discount_value, min_rental_months, max_discount_amount, start_date, end_date, usage_limit, used_count, facility_id, is_active)
VALUES
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'DISCOUNT_3M', 'Chiết khấu trả trước 3 tháng', 'Giảm 5% tổng phí thuê khi ký hợp đồng từ 3 tháng trở lên', 'PERCENTAGE', 5.00, 3, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', NULL, 0, NULL, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'DISCOUNT_6M', 'Chiết khấu trả trước 6 tháng', 'Giảm 10% tổng phí thuê khi thanh toán trọn gói 6 tháng', 'PERCENTAGE', 10.00, 6, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', NULL, 0, NULL, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'DISCOUNT_12M', 'Chiết khấu khách VIP 12 tháng', 'Giảm 15% tổng phí thuê cho hợp đồng thuê kho dài hạn 1 năm', 'PERCENTAGE', 15.00, 12, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', NULL, 0, NULL, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'BOXORA_WELCOME', 'Voucher Chào Mừng Khách Hàng Mới', 'Giảm trực tiếp 100.000 VNĐ cho đơn đặt chỗ đầu tiên qua ứng dụng', 'FIXED_AMOUNT', 100000.00, 1, 100000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 500, 12, NULL, TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SUMMER_MEGA_SALE', 'Khuyến Mãi Mùa Hè - Mega Storage', 'Giảm 8% cho kho diện tích lớn trên 10m2', 'PERCENTAGE', 8.00, 2, 500000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months', 200, 5, NULL, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 7.3 Seed staff_assignments (Phân công ca trực dựa theo User STAFF và Facility sẵn có)
INSERT INTO staff_assignments (id, created_at, updated_at, staff_id, facility_id, assigned_date, shift, assigned_zone, role_in_shift, status, assigned_by_id, notes)
SELECT
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    u.id,
    f.id,
    CURRENT_DATE,
    'MORNING',
    'Zone A - Tầng 1',
    'PRIMARY_STAFF',
    'ASSIGNED',
    mgr.id,
    'Ca trực sáng: tiếp nhận khách check-in, kiểm tra an ninh hành lang và đối soát kho'
FROM users u
CROSS JOIN facilities f
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER')
WHERE u.role_id IN (SELECT id FROM roles WHERE name = 'STAFF')
  AND f.code = 'HCM-D1'
LIMIT 1;

INSERT INTO staff_assignments (id, created_at, updated_at, staff_id, facility_id, assigned_date, shift, assigned_zone, role_in_shift, status, assigned_by_id, notes)
SELECT
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    u.id,
    f.id,
    CURRENT_DATE,
    'AFTERNOON',
    'Zone B - Kho lạnh & Khu gửi đồ nặng',
    'PRIMARY_STAFF',
    'ASSIGNED',
    mgr.id,
    'Ca trực chiều: kiểm tra cảm biến IoT, hỗ trợ khách gia hạn và xử lý ticket hỗ trợ'
FROM users u
CROSS JOIN facilities f
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER')
WHERE u.role_id IN (SELECT id FROM roles WHERE name = 'STAFF')
  AND f.code = 'HCM-D1'
LIMIT 1;

-- 7.4 Seed sample sealing_records (Mẫu biên bản niêm phong kho quá hạn BR-RULE-012)
INSERT INTO sealing_records (
    id, created_at, updated_at, storage_unit_id, contract_id, facility_id,
    seal_tag_number, reason, sealed_at, sealed_by_id, witness_id, status,
    photo_evidence_url, notes
)
SELECT
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    su.id,
    rc.id,
    f.id,
    'SEAL-2026-HCM01-0089',
    'Khách hàng quá hạn thanh toán trên 7 ngày theo quy định BR-RULE-012. Tiến hành niêm phong vật lý bảo toàn tài sản.',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    staff_user.id,
    mgr_user.id,
    'SEALED',
    'https://boxora-storage.s3.ap-southeast-1.amazonaws.com/evidence/seal-tag-0089.jpg',
    'Đã dán tem niêm phong số SEAL-0089 tại chốt cửa ngoài, khóa điện tử chuyển trạng thái OVERDUE_LOCKED.'
FROM storage_units su
JOIN facilities f ON su.facility_id = f.id
LEFT JOIN rental_contracts rc ON rc.unit_id = su.id
CROSS JOIN (SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE name = 'STAFF') LIMIT 1) staff_user
CROSS JOIN (SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') LIMIT 1) mgr_user
WHERE f.code = 'HCM-D1'
LIMIT 1;
