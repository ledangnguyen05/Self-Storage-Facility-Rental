-- =========================================================
-- V6: STORAGE UNIT PRICE HISTORIES & BR-RULE-011
-- =========================================================

-- 1. Thêm cột price_per_month vào bảng storage_units để hỗ trợ giá riêng cho từng kho (nếu có)
ALTER TABLE storage_units
    ADD COLUMN IF NOT EXISTS price_per_month NUMERIC(12, 2);

-- 2. Tạo bảng lưu trữ lịch sử điều chỉnh giá kho (BR-RULE-011: Audit trail & Grandfathering)
CREATE TABLE IF NOT EXISTS storage_unit_price_histories
(
    id              UUID          NOT NULL,
    created_at      TIMESTAMP     NOT NULL,
    updated_at      TIMESTAMP     NOT NULL,
    storage_unit_id UUID          NOT NULL,
    unit_type_id    UUID,
    old_price       NUMERIC(12, 2),
    new_price       NUMERIC(12, 2) NOT NULL,
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

-- 3. Thêm quyền hạn quản lý lịch sử giá (Permissions & Role Permissions)
INSERT INTO permissions (id, created_at, updated_at, name, permission_group, description, is_active)
VALUES
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PRICE_HISTORY_VIEW', 'STORAGE_UNIT', 'Xem lịch sử thay đổi giá kho (BR-RULE-011)', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PRICE_ADJUST', 'STORAGE_UNIT', 'Điều chỉnh giá thuê kho và ghi nhận lịch sử (BR-RULE-011)', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Phân quyền cho ADMIN (tự động kế thừa theo WHERE is_active = TRUE)
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
       r.id, p.id, TRUE, 'Admin price history access'
FROM roles r, permissions p
WHERE r.name = 'ADMIN'
  AND p.name IN ('PRICE_HISTORY_VIEW', 'PRICE_ADJUST')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Phân quyền cho BUSINESS_MANAGER
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
       r.id, p.id, TRUE, 'Business manager price adjustment permission'
FROM roles r, permissions p
WHERE r.name = 'BUSINESS_MANAGER'
  AND p.name IN ('PRICE_HISTORY_VIEW', 'PRICE_ADJUST')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Phân quyền cho FACILITY_MANAGER
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
       r.id, p.id, TRUE, 'Facility manager price history view and adjust'
FROM roles r, permissions p
WHERE r.name = 'FACILITY_MANAGER'
  AND p.name IN ('PRICE_HISTORY_VIEW', 'PRICE_ADJUST')
ON CONFLICT (role_id, permission_id) DO NOTHING;

