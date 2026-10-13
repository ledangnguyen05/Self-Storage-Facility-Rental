WITH new_facilities AS (
INSERT INTO facilities (id, name, code, address, city, contact_phone, email, status, open_time, close_time, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'StoreHub District 1', 'HCM-D1', '123 Nguyen Hue, Ben Nghe Ward', 'Ho Chi Minh City', '0901234567','storehubdistrict1@gmail.com', 'ACTIVE', '08:00:00', '20:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'StoreHub District 7', 'HCM-D7', '456 Nguyen Huu Tho, Tan Hung Ward', 'Ho Chi Minh City', '0902345678','storehubdistrict7@gmail.com', 'ACTIVE', '08:00:00', '20:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'StoreHub Thu Duc', 'HCM-TD', '789 Vo Van Ngan, Linh Chieu Ward', 'Ho Chi Minh City', '0903456789','storehubthuduc@gmail.com', 'ACTIVE', '08:00:00', '20:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
FROM new_facilities;