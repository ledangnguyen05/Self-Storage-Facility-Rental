-- =========================================================================
-- V21: Seed Support Tickets (8 tickets across various categories & priorities)
-- =========================================================================

INSERT INTO support_tickets (
    id, ticket_code, user_id, booking_id, category, title, description,
    status, priority, assigned_staff_id, resolution_note, created_at, updated_at
)
VALUES
    ('33330000-0000-0000-0000-000000000001', 'TK-2026-0001', 'e0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001',
     'PIN_CODE', 'Yêu cầu cấp lại mã PIN do quên mật khẩu', 'Tôi đến cơ sở lúc 19h nhưng không nhớ mã PIN 6 số, nhờ hỗ trợ gửi lại qua email.',
     'RESOLVED', 'HIGH', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'Đã xác thực CCCD khách hàng qua Zalo và reset mã PIN mới thành công.',
     NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),

    ('33330000-0000-0000-0000-000000000002', 'TK-2026-0002', 'e0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002',
     'LOCK_ISSUE', 'Ổ khóa thông minh chập chờn khi nhập mã', 'Bàn phím cảm ứng trên cửa kho A-104 phản hồi chậm khi bấm phím số 8.',
     'RESOLVED', 'MEDIUM', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'Kỹ thuật viên đã lau sạch bề mặt cảm ứng và cập nhật firmware khóa IoT.',
     NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),

    ('33330000-0000-0000-0000-000000000003', 'TK-2026-0003', 'e0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003',
     'PAYMENT_ISSUE', 'Hóa đơn điện tử VAT cho công ty', 'Nhờ quầy gửi hóa đơn điện tử GTGT tháng 9 cho công ty TNHH Hóa Mỹ Phẩm An Bình.',
     'IN_PROGRESS', 'MEDIUM', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'Đã chuyển thông tin mã số thuế cho bộ phận Kế toán xuất e-Invoice.',
     NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

    ('33330000-0000-0000-0000-000000000004', 'TK-2026-0004', 'e0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004',
     'FACILITY_DAMAGE', 'Đèn LED hành lang tầng 2 khu B bị nhấp nháy', 'Đoạn hành lang trước kho B-202 bóng đèn LED bị chớp giật gây khó quan sát khi dỡ hàng ban đêm.',
     'OPEN', 'LOW', 'bce331ef-5656-4fa6-bb19-8528a10e9671', NULL,
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

    ('33330000-0000-0000-0000-000000000005', 'TK-2026-0005', 'e0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000005',
     'OTHER', 'Mượn xe nâng tay và pallet di chuyển đồ nặng', 'Sáng thứ 7 tôi chuyển 30 thùng tài liệu vào kho, nhờ quầy chuẩn bị xe đẩy 4 bánh lớn.',
     'RESOLVED', 'LOW', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'Đã bố trí sẵn xe đẩy số 01 tại sảnh bốc dỡ hàng hóa tầng 1.',
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),

    ('33330000-0000-0000-0000-000000000006', 'TK-2026-0006', 'afc5e388-0c32-40f2-b909-4df9837d2253', 'c0000000-0000-0000-0000-000000000007',
     'LOCK_ISSUE', 'Khóa phát tiếng bíp cảnh báo pin yếu', 'Mỗi lần mở kho C-102 khóa kêu 3 tiếng bíp ngắn.',
     'RESOLVED', 'HIGH', 'e0000000-0000-0000-0000-000000000005', 'Đã thay bộ pin 4 viên AA mới, ổ khóa hoạt động êm ái.',
     NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'),

    ('33330000-0000-0000-0000-000000000007', 'TK-2026-0007', 'e4048fe9-bbc6-4b41-8f93-bd8e7b73e7a0', 'c0000000-0000-0000-0000-000000000008',
     'OTHER', 'Hỏi thủ tục ủy quyền cho nhân viên vào lấy hàng', 'Tôi muốn cấp mã PIN phụ cho tài xế giao nhận vào lấy kiện hàng số 4.',
     'OPEN', 'MEDIUM', NULL, NULL,
     NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),

    ('33330000-0000-0000-0000-000000000008', 'TK-2026-0008', 'cd45b91a-5267-4478-aa59-f6f37e678344', 'c0000000-0000-0000-0000-000000000006',
     'PAYMENT_ISSUE', 'Khiếu nại phí phạt chậm thanh toán hợp đồng B-203', 'Tôi đi công tác nước ngoài nên chưa kịp chuyển tiền, xin miễn giảm phí phạt trễ hạn.',
     'IN_PROGRESS', 'URGENT', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'Đã chuyển báo cáo lên Facility Manager Q7 xem xét theo điều khoản miễn trừ bất khả kháng.',
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours')
ON CONFLICT (ticket_code) DO NOTHING;
