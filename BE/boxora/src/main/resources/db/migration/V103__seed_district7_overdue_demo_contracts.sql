-- ==============================================================================
-- Migration V103: Seed 5 rows for Grace Period and 5 rows for Warning in Boxora District 7
-- Boxora District 7 facility_id = '45e03ded-5da1-43d5-bea7-96c645d5f96c'
-- ==============================================================================

-- 1. Ensure units in District 7 are OCCUPIED
UPDATE storage_units
SET status = 'OCCUPIED', updated_at = NOW()
WHERE id IN (
    'df29f227-7308-400d-bfee-ef9c7458da65', -- D7-A107
    'b9e35b7e-4f70-45ce-a26e-e875d70c8794', -- D7-A108
    '75e010b5-5401-452a-89fe-be91487fc341', -- D7-A110
    'b0000000-0007-0000-0000-000000000111', -- D7-A111
    'b0000000-0007-0000-0000-000000000112', -- D7-A112
    'bd215f14-d75b-4e33-bc14-8f3d71651d18', -- D7-B104
    'f5ce6dc9-3eb6-4886-8173-c53fff4427b3', -- D7-B105
    '4ff4ca58-feb7-4f92-a131-b31234329731', -- D7-B107
    'fc68a013-4ad2-4ed2-bc40-e841b6fddd4b', -- D7-B109
    'be8e421b-1af8-4428-9fc2-cd2be2f749c0'  -- D7-B110
);

-- 2. Seed 5 Contracts for Group 1: ÂN HẠN (1 ngày quá hạn, overdueDays = 1, lateFee = 0)
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id,
    start_date, end_date, monthly_fee, deposit_held, status, signing_method,
    is_demo, overdue_pin_status, overdue_sealing_status, smart_lock_online_status, smart_lock_is_mock
)
VALUES
    ('c0000007-0001-0000-0000-000000000001', NOW(), NOW(), 'CTR-D7-GRACE-01', 'e0000000-0000-0000-0000-000000000007', 'df29f227-7308-400d-bfee-ef9c7458da65', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 31, CURRENT_DATE - 1, 1500000.00, 1500000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000007-0001-0000-0000-000000000002', NOW(), NOW(), 'CTR-D7-GRACE-02', 'e0000000-0000-0000-0000-000000000008', 'b9e35b7e-4f70-45ce-a26e-e875d70c8794', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 31, CURRENT_DATE - 1, 1800000.00, 1800000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000007-0001-0000-0000-000000000003', NOW(), NOW(), 'CTR-D7-GRACE-03', 'e0000000-0000-0000-0000-000000000009', '75e010b5-5401-452a-89fe-be91487fc341', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 31, CURRENT_DATE - 1, 2100000.00, 2100000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000007-0001-0000-0000-000000000004', NOW(), NOW(), 'CTR-D7-GRACE-04', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0007-0000-0000-000000000111', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 31, CURRENT_DATE - 1, 1600000.00, 1600000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000007-0001-0000-0000-000000000005', NOW(), NOW(), 'CTR-D7-GRACE-05', 'e0000000-0000-0000-0000-000000000011', 'b0000000-0007-0000-0000-000000000112', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 31, CURRENT_DATE - 1, 2400000.00, 2400000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE)
ON CONFLICT (id) DO UPDATE SET
    end_date = EXCLUDED.end_date,
    status = EXCLUDED.status,
    facility_id = EXCLUDED.facility_id;

-- 3. Seed 5 Contracts for Group 2: CẢNH BÁO (2 ngày quá hạn, overdueDays = 2, lateFee = 200,000)
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id,
    start_date, end_date, monthly_fee, deposit_held, status, signing_method,
    is_demo, overdue_pin_status, overdue_sealing_status, smart_lock_online_status, smart_lock_is_mock
)
VALUES
    ('c0000007-0002-0000-0000-000000000001', NOW(), NOW(), 'CTR-D7-WARN-01', 'e0000000-0000-0000-0000-000000000008', 'bd215f14-d75b-4e33-bc14-8f3d71651d18', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 32, CURRENT_DATE - 2, 1400000.00, 1400000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000007-0002-0000-0000-000000000002', NOW(), NOW(), 'CTR-D7-WARN-02', 'e0000000-0000-0000-0000-000000000009', 'f5ce6dc9-3eb6-4886-8173-c53fff4427b3', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 32, CURRENT_DATE - 2, 1900000.00, 1900000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000007-0002-0000-0000-000000000003', NOW(), NOW(), 'CTR-D7-WARN-03', 'e0000000-0000-0000-0000-000000000010', '4ff4ca58-feb7-4f92-a131-b31234329731', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 32, CURRENT_DATE - 2, 2200000.00, 2200000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000007-0002-0000-0000-000000000004', NOW(), NOW(), 'CTR-D7-WARN-04', 'e0000000-0000-0000-0000-000000000011', 'fc68a013-4ad2-4ed2-bc40-e841b6fddd4b', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 32, CURRENT_DATE - 2, 1700000.00, 1700000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000007-0002-0000-0000-000000000005', NOW(), NOW(), 'CTR-D7-WARN-05', 'e0000000-0000-0000-0000-000000000007', 'be8e421b-1af8-4428-9fc2-cd2be2f749c0', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 32, CURRENT_DATE - 2, 2500000.00, 2500000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE)
ON CONFLICT (id) DO UPDATE SET
    end_date = EXCLUDED.end_date,
    status = EXCLUDED.status,
    facility_id = EXCLUDED.facility_id;

-- 4. Initial Audit Logs for New Contracts
INSERT INTO overdue_audit_logs (contract_id, action, performed_by_name, performed_by_role, before_state, after_state, details)
VALUES
    ('c0000007-0001-0000-0000-000000000001', 'OVERDUE_DETECTED', 'Hệ thống tự động', 'SYSTEM', 'ACTIVE', 'OVERDUE', 'Hợp đồng quá hạn 1 ngày. Đang trong thời gian ân hạn miễn phí phạt.'),
    ('c0000007-0001-0000-0000-000000000002', 'OVERDUE_DETECTED', 'Hệ thống tự động', 'SYSTEM', 'ACTIVE', 'OVERDUE', 'Hợp đồng quá hạn 1 ngày. Đang trong thời gian ân hạn miễn phí phạt.'),
    ('c0000007-0001-0000-0000-000000000003', 'OVERDUE_DETECTED', 'Hệ thống tự động', 'SYSTEM', 'ACTIVE', 'OVERDUE', 'Hợp đồng quá hạn 1 ngày. Đang trong thời gian ân hạn miễn phí phạt.'),
    ('c0000007-0001-0000-0000-000000000004', 'OVERDUE_DETECTED', 'Hệ thống tự động', 'SYSTEM', 'ACTIVE', 'OVERDUE', 'Hợp đồng quá hạn 1 ngày. Đang trong thời gian ân hạn miễn phí phạt.'),
    ('c0000007-0001-0000-0000-000000000005', 'OVERDUE_DETECTED', 'Hệ thống tự động', 'SYSTEM', 'ACTIVE', 'OVERDUE', 'Hợp đồng quá hạn 1 ngày. Đang trong thời gian ân hạn miễn phí phạt.'),
    ('c0000007-0002-0000-0000-000000000001', 'WARNING_ISSUED', 'Hệ thống tự động', 'SYSTEM', 'GRACE_PERIOD', 'WARNING', 'Hợp đồng quá hạn 2 ngày. Phát sinh phí phạt trễ hạn 200.000 VNĐ.'),
    ('c0000007-0002-0000-0000-000000000002', 'WARNING_ISSUED', 'Hệ thống tự động', 'SYSTEM', 'GRACE_PERIOD', 'WARNING', 'Hợp đồng quá hạn 2 ngày. Phát sinh phí phạt trễ hạn 200.000 VNĐ.'),
    ('c0000007-0002-0000-0000-000000000003', 'WARNING_ISSUED', 'Hệ thống tự động', 'SYSTEM', 'GRACE_PERIOD', 'WARNING', 'Hợp đồng quá hạn 2 ngày. Phát sinh phí phạt trễ hạn 200.000 VNĐ.'),
    ('c0000007-0002-0000-0000-000000000004', 'WARNING_ISSUED', 'Hệ thống tự động', 'SYSTEM', 'GRACE_PERIOD', 'WARNING', 'Hợp đồng quá hạn 2 ngày. Phát sinh phí phạt trễ hạn 200.000 VNĐ.'),
    ('c0000007-0002-0000-0000-000000000005', 'WARNING_ISSUED', 'Hệ thống tự động', 'SYSTEM', 'GRACE_PERIOD', 'WARNING', 'Hợp đồng quá hạn 2 ngày. Phát sinh phí phạt trễ hạn 200.000 VNĐ.')
ON CONFLICT DO NOTHING;

-- 5. Initial Notice Logs for Warning Contracts
INSERT INTO overdue_notice_logs (contract_id, customer_id, channel, template_type, content, sent_at, delivery_status, notes)
VALUES
    ('c0000007-0002-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000008', 'SMS', 'WARNING', '[Boxora] Thông báo: Hợp đồng CTR-D7-WARN-01 đã quá hạn 2 ngày. Phí phạt phát sinh 200.000đ. Vui lòng thanh toán để tránh bị khóa SmartLock.', NOW() - INTERVAL '1 day', 'DELIVERED', 'Gửi tự động qua SMS Gateway'),
    ('c0000007-0002-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000009', 'EMAIL', 'WARNING', '[Boxora] Nhắc nợ cước: Hợp đồng CTR-D7-WARN-02 tại Boxora Quận 7 đã quá hạn thanh toán.', NOW() - INTERVAL '1 day', 'DELIVERED', 'Gửi qua email khách hàng'),
    ('c0000007-0002-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000010', 'SMS', 'WARNING', '[Boxora] Thông báo: Hợp đồng CTR-D7-WARN-03 đã quá hạn 2 ngày. Vui lòng thanh toán.', NOW() - INTERVAL '1 day', 'DELIVERED', 'Gửi tự động qua SMS Gateway')
ON CONFLICT DO NOTHING;
