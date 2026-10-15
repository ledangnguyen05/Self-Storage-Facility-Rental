-- =========================================================================
-- V19: Seed Handover Records (8 records: 4 Check-In, 4 Check-Out)
-- =========================================================================

INSERT INTO handover_records (
    id, created_at, updated_at, booking_id, staff_id, record_type, unit_condition, notes,
    recorded_at, checklist_summary, deduction_amount, deposit_settled, evidence_photos, refund_amount, review_status
)
VALUES
    -- Check-in 1: cust_minh at A-102
    ('11110000-0000-0000-0000-000000000001', '2026-03-01 10:15:00', NOW(), 'c0000000-0000-0000-0000-000000000001', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'CHECK_IN',
     'Kho nguyên vẹn 100%, sàn sạch, khóa IoT hoạt động trơn tru.', 'Khách nhận phòng đúng hẹn, cấp mã PIN và bàn giao thẻ RFID số RF-401.',
     '2026-03-01 10:15:00', '5/5 tiêu chuẩn nghiệm thu đạt chuẩn', 0.00, 1250000.00, 'https://boxora.vn/photos/handover/A102_in.jpg', 0.00, 'COMPLETED'),

    -- Check-in 2: cust_lan at A-104
    ('11110000-0000-0000-0000-000000000002', '2026-04-10 15:30:00', NOW(), 'c0000000-0000-0000-0000-000000000002', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'CHECK_IN',
     'Cửa cuốn điện hoạt động tốt, hệ thống cảm biến khói bình thường.', 'Khách gửi hàng mẫu xuất nhập khẩu, mượn xe đẩy số 02.',
     '2026-04-10 15:30:00', '5/5 tiêu chuẩn nghiệm thu đạt chuẩn', 0.00, 4800000.00, 'https://boxora.vn/photos/handover/A104_in.jpg', 0.00, 'COMPLETED'),

    -- Check-in 3: cust_phuong at B-102
    ('11110000-0000-0000-0000-000000000003', '2026-06-01 11:20:00', NOW(), 'c0000000-0000-0000-0000-000000000004', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'CHECK_IN',
     'Kho sạch sẽ, hệ thống điều hòa vi khí hậu 21°C đạt chuẩn.', 'Bàn giao chìa khóa dự phòng niêm phong và hướng dẫn mở cửa bằng Bluetooth/App.',
     '2026-06-01 11:20:00', '5/5 tiêu chuẩn nghiệm thu đạt chuẩn', 0.00, 1250000.00, 'https://boxora.vn/photos/handover/B102_in.jpg', 0.00, 'COMPLETED'),

    -- Check-in 4: dnguyen at C-102
    ('11110000-0000-0000-0000-000000000004', '2026-07-01 10:30:00', NOW(), 'c0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000005', 'CHECK_IN',
     'Hiện trạng hoàn hảo, khóa điện tử pin 100%.', 'Bàn giao cho khách hàng cá nhân chứa vật dụng gia đình.',
     '2026-07-01 10:30:00', '5/5 tiêu chuẩn nghiệm thu đạt chuẩn', 0.00, 1250000.00, 'https://boxora.vn/photos/handover/C102_in.jpg', 0.00, 'COMPLETED'),

    -- Check-out 1: Hoàn cọc đầy đủ cho booking 16
    ('11110000-0000-0000-0000-000000000005', '2025-12-01 15:30:00', NOW(), 'c0000000-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000005', 'CHECK_OUT',
     'Kho trả lại sạch sẽ, không hư hỏng tài sản.', 'Đã thu hồi thẻ RFID, giải tỏa mã PIN truy cập.',
     '2025-12-01 15:30:00', '5/5 tiêu chuẩn kiểm tra đạt yêu cầu', 0.00, 450000.00, 'https://boxora.vn/photos/handover/C101_out.jpg', 450000.00, 'COMPLETED'),

    -- Check-out 2: Hoàn cọc đầy đủ cho booking 17
    ('11110000-0000-0000-0000-000000000006', '2026-01-02 10:00:00', NOW(), 'c0000000-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000006', 'CHECK_OUT',
     'Kho trả lại đúng hiện trạng bàn giao ban đầu.', 'Khách dọn hết đồ đạc, thanh lý hợp đồng đúng hạn.',
     '2026-01-02 10:00:00', '5/5 tiêu chuẩn kiểm tra đạt yêu cầu', 0.00, 450000.00, 'https://boxora.vn/photos/handover/D101_out.jpg', 450000.00, 'COMPLETED'),

    -- Check-out 3: Có khấu trừ phí vệ sinh và chuyển Kế toán duyệt hoàn cọc
    ('11110000-0000-0000-0000-000000000007', NOW() - INTERVAL '3 days', NOW(), 'c0000000-0000-0000-0000-000000000018', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'CHECK_OUT',
     'Mặt sàn có vết bẩn dầu mỡ cần xử lý tẩy rửa công nghiệp.', 'Khách đồng ý khấu trừ 150.000đ phí vệ sinh tiêu chuẩn từ tiền cọc.',
     NOW() - INTERVAL '3 days', '4/5 tiêu chuẩn đạt (Cần vệ sinh sàn)', 150000.00, 2400000.00, 'https://boxora.vn/photos/handover/A103_stain.jpg', 2250000.00, 'PENDING_ACCOUNTING_REVIEW'),

    -- Check-out 4: Đã lập biên bản kiểm tra trả kho cơ sở Q7
    ('11110000-0000-0000-0000-000000000008', NOW() - INTERVAL '1 day', NOW(), 'c0000000-0000-0000-0000-000000000006', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'CHECK_OUT',
     'Kiểm kê tài sản tồn đọng sau khi kho quá hạn thanh toán.', 'Lập biên bản ghi nhận hiện trạng để tiến hành thủ tục pháp lý niêm phong.',
     NOW() - INTERVAL '1 day', 'Kiểm tra hiện trạng niêm phong', 0.00, 2400000.00, 'https://boxora.vn/photos/handover/B203_sealed.jpg', 0.00, 'COMPLETED')
ON CONFLICT (id) DO NOTHING;
