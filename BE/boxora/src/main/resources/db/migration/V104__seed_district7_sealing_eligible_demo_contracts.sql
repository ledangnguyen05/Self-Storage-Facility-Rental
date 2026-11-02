-- ==============================================================================
-- Migration V104: Seed 5 rows for Sealing Eligible (>= 7 days) in Boxora District 7
-- Boxora District 7 facility_id = '45e03ded-5da1-43d5-bea7-96c645d5f96c'
-- ==============================================================================

-- 1. Ensure units in District 7 are OCCUPIED
UPDATE storage_units
SET status = 'OCCUPIED', updated_at = NOW()
WHERE id IN (
    'b0000000-0000-0000-0000-000000000209', -- D7-C201
    'b0000000-0000-0000-0000-000000000211', -- D7-C203
    'b0000000-0000-0000-0000-000000000212', -- D7-C204
    'ccdde4c5-fa04-41db-99c1-0df750481e21', -- D7-C205
    'a107f6cb-6b77-4f0c-80b7-2786f6eb21a9'  -- D7-C207
);

-- 2. Seed 5 Contracts for Group 4: ĐỦ ĐIỀU KIỆN NIÊM PHONG (overdueDays >= 7)
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id,
    start_date, end_date, monthly_fee, deposit_held, status, signing_method,
    is_demo, overdue_pin_status, overdue_sealing_status, smart_lock_online_status, smart_lock_is_mock
)
VALUES
    ('c0000007-0004-0000-0000-000000000001', NOW(), NOW(), 'CTR-D7-SEAL-01', 'e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000209', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 37, CURRENT_DATE - 7, 1500000.00, 1500000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_ELIGIBLE', 'ONLINE', TRUE),
    ('c0000007-0004-0000-0000-000000000002', NOW(), NOW(), 'CTR-D7-SEAL-02', 'e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000211', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 38, CURRENT_DATE - 8, 1900000.00, 1900000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_REQUESTED', 'ONLINE', TRUE),
    ('c0000007-0004-0000-0000-000000000003', NOW(), NOW(), 'CTR-D7-SEAL-03', 'e0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000212', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 40, CURRENT_DATE - 10, 2400000.00, 2400000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_APPROVED', 'ONLINE', TRUE),
    ('c0000007-0004-0000-0000-000000000004', NOW(), NOW(), 'CTR-D7-SEAL-04', 'e0000000-0000-0000-0000-000000000010', 'ccdde4c5-fa04-41db-99c1-0df750481e21', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 42, CURRENT_DATE - 12, 1600000.00, 1600000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_IN_PROGRESS', 'ONLINE', TRUE),
    ('c0000007-0004-0000-0000-000000000005', NOW(), NOW(), 'CTR-D7-SEAL-05', 'e0000000-0000-0000-0000-000000000011', 'a107f6cb-6b77-4f0c-80b7-2786f6eb21a9', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 45, CURRENT_DATE - 15, 2000000.00, 2000000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_COMPLETED', 'ONLINE', TRUE)
ON CONFLICT (id) DO UPDATE SET
    end_date = EXCLUDED.end_date,
    status = EXCLUDED.status,
    overdue_sealing_status = EXCLUDED.overdue_sealing_status,
    facility_id = EXCLUDED.facility_id;

-- 3. Seed Sealing Record and Inventory Items for CTR-D7-SEAL-05
INSERT INTO sealing_records (
    id, created_at, updated_at, storage_unit_id, contract_id, facility_id, seal_tag_number,
    reason, sealed_at, sealed_by_id, witness_id, status, protocol_number, overdue_days,
    total_debt_amount, inventory_summary, request_status
)
VALUES (
    'a0000007-0004-0000-0000-000000000005',
    NOW(), NOW(),
    'a107f6cb-6b77-4f0c-80b7-2786f6eb21a9',
    'c0000007-0004-0000-0000-000000000005',
    '45e03ded-5da1-43d5-bea7-96c645d5f96c',
    'SEAL-D7-2026-8805',
    'Quá hạn 15 ngày vượt ngưỡng quy định, đã gửi 3 thông báo và thu hồi mã SmartLock PIN nhưng khách không phản hồi.',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    'bce331ef-5656-4fa6-bb19-8528a10e9671',
    'e0000000-0000-0000-0000-000000000002',
    'SEALED',
    'BB-NP-2026-D705',
    15,
    4800000.00,
    'Kiểm kê hiện trường: 01 Bộ máy pha cà phê DeLonghi, 02 Thùng tài liệu kế toán niêm phong, 01 Hộp linh kiện điện tử',
    'COMPLETED'
)
ON CONFLICT (seal_tag_number) DO NOTHING;

INSERT INTO asset_inventory_items (id, created_at, updated_at, sealing_record_id, item_name, quantity, condition_status, estimated_value, notes)
VALUES
    (gen_random_uuid(), NOW(), NOW(), 'a0000007-0004-0000-0000-000000000005', 'Máy pha cà phê tự động DeLonghi Magnifica S', 1, 'Đã qua sử dụng, hoạt động tốt', 6500000.00, 'Kèm dây nguồn và khay nước'),
    (gen_random_uuid(), NOW(), NOW(), 'a0000007-0004-0000-0000-000000000005', 'Thùng carton niêm phong hồ sơ hóa đơn chứng từ', 2, 'Khô ráo, nguyên vẹn', 400000.00, 'Dán tem niêm phong Boxora D7'),
    (gen_random_uuid(), NOW(), NOW(), 'a0000007-0004-0000-0000-000000000005', 'Hộp nhựa đựng thiết bị đo kiểm và linh kiện mạng', 1, 'Nguyên hộp, có khóa chốt', 2200000.00, 'Thiết bị văn phòng IT')
ON CONFLICT DO NOTHING;

-- 4. Initial Audit Logs for Sealing Contracts
INSERT INTO overdue_audit_logs (contract_id, action, performed_by_name, performed_by_role, before_state, after_state, details)
VALUES
    ('c0000007-0004-0000-0000-000000000001', 'SEALING_ELIGIBLE_DETECTED', 'Hệ thống tự động', 'SYSTEM', 'PIN_REVOKED', 'SEALING_ELIGIBLE', 'Hợp đồng quá hạn 7 ngày. Đủ điều kiện lập đề xuất niêm phong buồng kho.'),
    ('c0000007-0004-0000-0000-000000000002', 'SEALING_PROPOSED', 'Bui Quoc Anh', 'STAFF', 'SEALING_ELIGIBLE', 'SEALING_REQUESTED', 'Nhân viên đã kiểm tra hiện trường kho và gửi yêu cầu niêm phong chờ Quản lý duyệt.'),
    ('c0000007-0004-0000-0000-000000000003', 'SEALING_APPROVED', 'Le Hoang Nam', 'FACILITY_MANAGER', 'SEALING_REQUESTED', 'SEALING_APPROVED', 'Quản lý cơ sở đã phê duyệt lệnh niêm phong. Chờ nhân viên thực hiện dán tem niêm phong.'),
    ('c0000007-0004-0000-0000-000000000004', 'SEALING_COMMENCED', 'Bui Quoc Anh', 'STAFF', 'SEALING_APPROVED', 'SEALING_IN_PROGRESS', 'Đang thực hiện dán tem niêm phong và lập danh mục kiểm kê tài sản.'),
    ('c0000007-0004-0000-0000-000000000005', 'SEALING_COMPLETED', 'Le Hoang Nam', 'FACILITY_MANAGER', 'SEALING_IN_PROGRESS', 'SEALING_COMPLETED', 'Đã hoàn tất dán tem niêm phong SEAL-D7-2026-8805 và lập danh mục kiểm kê 03 mục tài sản.')
ON CONFLICT DO NOTHING;

-- 5. Initial Notice Logs for Sealing Contracts
INSERT INTO overdue_notice_logs (contract_id, customer_id, channel, template_type, content, sent_at, delivery_status, notes)
VALUES
    ('c0000007-0004-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000007', 'MULTI', 'SEAL_WARNING', '[Boxora - Thông Báo Khẩn] Hợp đồng CTR-D7-SEAL-01 quá hạn 7 ngày. Buồng kho sẽ bị niêm phong nếu không thanh toán trong 24h.', NOW() - INTERVAL '2 days', 'DELIVERED', 'Gửi đồng thời SMS và Email'),
    ('c0000007-0004-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000011', 'CALL', 'SEAL_WARNING', '[Boxora] Nhân viên đã liên hệ qua điện thoại nhưng khách hàng thuê kho không bắt máy.', NOW() - INTERVAL '3 days', 'DELIVERED', 'Gọi viễn thông xác nhận nhắc nợ')
ON CONFLICT DO NOTHING;
