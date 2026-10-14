-- =========================================================================
-- V20: Seed Smart Key / Master Key Overrides (6 audit/emergency/maintenance logs)
-- =========================================================================

INSERT INTO master_key_overrides (
    id, created_at, updated_at, facility_id, performed_by_id, witness_id, category, severity, reason, document_reference, resource_type, resource_id
)
VALUES
    ('22220000-0000-0000-0000-000000000001', '2026-09-10 14:00:00', NOW(), 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', '43695aac-1802-4a5d-82aa-2ef466796e10', 'EMERGENCY', 'CRITICAL', 'Cảm biến báo nhiệt độ buồng kho tăng cao bất thường; mở kiểm tra an toàn PCCC.', 'BB-KH-2026-091', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000204'),
    ('22220000-0000-0000-0000-000000000002', '2026-09-15 09:30:00', NOW(), '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'e0000000-0000-0000-0000-000000000002', 'MAINTENANCE', 'HIGH', 'Pin ổ khóa điện tử SmartLock báo dưới 10%; thay pin khẩn cấp bảo đảm kết nối.', 'BB-BT-2026-112', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000210'),
    ('22220000-0000-0000-0000-000000000003', '2026-09-20 10:15:00', NOW(), 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000003', 'AUDIT', 'MEDIUM', 'Kiểm tra độ ẩm định kỳ theo tiêu chuẩn bảo quản tài liệu văn phòng.', 'BB-KT-2026-045', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000306'),
    ('22220000-0000-0000-0000-000000000004', '2026-09-28 16:20:00', NOW(), 'a1111111-2222-3333-4444-555555555555', 'e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000004', 'EMERGENCY', 'HIGH', 'Hỗ trợ khách hàng mở kho khẩn cấp do điện thoại hết pin và không nhớ mã PIN.', 'BB-HOTRO-2026-08', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000402'),
    ('22220000-0000-0000-0000-000000000005', '2026-10-02 11:00:00', NOW(), 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', '43695aac-1802-4a5d-82aa-2ef466796e10', 'MAINTENANCE', 'MEDIUM', 'Kỹ thuật viên kiểm tra tra dầu ray trượt cửa cuốn buồng kho.', 'BB-BT-2026-130', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000104'),
    ('22220000-0000-0000-0000-000000000006', '2026-10-08 15:45:00', NOW(), '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'e0000000-0000-0000-0000-000000000002', 'AUDIT', 'HIGH', 'Niêm phong kho quá hạn ngày thứ 7 theo quy chuẩn BR-RULE-012.', 'BB-NP-2026-007', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000211')
ON CONFLICT (id) DO NOTHING;
