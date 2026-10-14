-- =========================================================================
-- V5: Seed Facilities and Policies (HCM-D1, HCM-D7, HCM-TD, HCM-TB)
-- =========================================================================

WITH new_facilities AS (
INSERT INTO facilities (id, name, code, address, city, contact_phone, email, status, open_time, close_time, created_at, updated_at, description)
VALUES
    ('f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'StoreHub District 1', 'HCM-D1', '123 Nguyen Hue, Ben Nghe Ward', 'Ho Chi Minh City', '0901234567','storehubdistrict1@gmail.com', 'ACTIVE', '08:00:00', '20:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Cơ sở trung tâm Quận 1'),
    ('45e03ded-5da1-43d5-bea7-96c645d5f96c', 'StoreHub District 7', 'HCM-D7', '456 Nguyen Huu Tho, Tan Hung Ward', 'Ho Chi Minh City', '0902345678','storehubdistrict7@gmail.com', 'ACTIVE', '08:00:00', '20:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Cơ sở Quận 7 Nam Sài Gòn'),
    ('fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'StoreHub Thu Duc', 'HCM-TD', '789 Vo Van Ngan, Linh Chieu Ward', 'Ho Chi Minh City', '0903456789','storehubthuduc@gmail.com', 'ACTIVE', '08:00:00', '20:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Cơ sở Thành phố Thủ Đức'),
    ('a1111111-2222-3333-4444-555555555555', 'StoreHub Tan Binh Mega Hub', 'HCM-TB', '102 Truong Son, Ward 2, Tan Binh District', 'Ho Chi Minh City', '0904567890', 'tanbinh@boxora.vn', 'ACTIVE', '08:00:00', '21:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Cơ sở trung tâm tiếp giáp sân bay Tân Sơn Nhất, phục vụ lưu kho cá nhân và kho thương mại điện tử 24/7.')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, address = EXCLUDED.address, status = EXCLUDED.status, description = EXCLUDED.description
RETURNING id
)
INSERT INTO facility_policies (
    id, created_at, updated_at, facility_id, deposit_percentage,
    renewal_window_days,
    cancellation_full_refund_hours, cancellation_partial_refund_hours, cancellation_partial_refund_percent,
    return_notice_days, deposit_refund_sla_days,
    daily_late_fee, overdue_grace_days, overdue_access_disable_days, overdue_sealing_days,
    minimum_rental_months
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, id, 100.0,
    3,
    48, 24, 50.0,
    0, 5,
    50000.00, 1, 3, 7,
    1
FROM new_facilities
ON CONFLICT (facility_id) DO NOTHING;