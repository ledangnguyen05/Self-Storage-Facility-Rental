-- =========================================================================
-- V24: Seed Notification Logs (15 notifications: reminders, confirmations, etc.)
-- =========================================================================

INSERT INTO notification_logs (
    id, created_at, updated_at, recipient_id, recipient_email, recipient_name, facility_id, channel,
    notification_type, reference_type, reference_id, title, content, status
)
VALUES
    ('44440000-0000-0000-0000-000000000001', '2026-03-01 09:07:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'PAYMENT_SUCCESS', 'PAYMENT', 'f0000000-0000-0000-0000-000000000001',
     'Thanh toán thành công đơn đặt kho #BX-2026-1001', 'Boxora đã nhận thanh toán tiền cọc 1.250.000₫ và tiền thuê cho buồng kho A-102. Chúc quý khách trải nghiệm dịch vụ tiện ích!', 'SENT'),

    ('44440000-0000-0000-0000-000000000002', '2026-03-01 09:12:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'CONTRACT_READY_TO_SIGN', 'CONTRACT', 'd0000000-0000-0000-0000-000000000001',
     'Hợp đồng thuê kho điện tử #CTR-2026-1001 đã sẵn sàng ký', 'Kính mời quý khách kiểm tra điều khoản và thực hiện ký điện tử bằng mã OTP đã gửi qua email.', 'SENT'),

    ('44440000-0000-0000-0000-000000000003', '2026-03-01 10:20:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'PIN_DISPATCHED', 'BOOKING', 'c0000000-0000-0000-0000-000000000001',
     'Mã PIN truy cập kho số hóa của bạn: 739215', 'Mã khóa phòng kho A-102 đã được kích hoạt trên hệ thống IoT. Quý khách có thể mở cửa 24/7.', 'SENT'),

    ('44440000-0000-0000-0000-000000000004', '2026-04-10 14:08:00', NOW(), 'e0000000-0000-0000-0000-000000000008', 'hoangyen.le@gmail.com', 'Lê Thị Hoàng Yến', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'BOOKING_CONFIRMED', 'BOOKING', 'c0000000-0000-0000-0000-000000000002',
     'Xác nhận giữ chỗ thành công kho #A-104', 'Đơn đặt kho #BX-2026-1002 đã được xác nhận. Hẹn gặp quý khách tại cơ sở Quận 1.', 'SENT'),

    ('44440000-0000-0000-0000-000000000005', '2026-05-15 08:38:00', NOW(), 'e0000000-0000-0000-0000-000000000009', 'namanh.hoang@gmail.com', 'Hoàng Nam Anh', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'HANDOVER_COMPLETED', 'HANDOVER', '11110000-0000-0000-0000-000000000002',
     'Biên bản bàn giao kho #A-203 đã được ký kết', 'Quá trình nghiệm thu hiện trường hoàn tất, chúc quý khách lưu trữ đồ an toàn và thuận tiện.', 'SENT'),

    ('44440000-0000-0000-0000-000000000006', '2026-06-01 10:10:00', NOW(), 'e0000000-0000-0000-0000-000000000010', 'maiphuong.pham@gmail.com', 'Phạm Mai Phương', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'EMAIL',
     'PAYMENT_SUCCESS', 'PAYMENT', 'f0000000-0000-0000-0000-000000000006',
     'Xác nhận thanh toán tiền thuê buồng kho #B-102', 'Cảm ơn quý khách đã tin tưởng dịch vụ Boxora cơ sở Quận 7 Nam Sài Gòn.', 'SENT'),

    ('44440000-0000-0000-0000-000000000007', '2026-06-24 09:00:00', NOW(), 'cd45b91a-5267-4478-aa59-f6f37e678344', 'customer@gmail.com', 'System Customer', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'EMAIL',
     'EXPIRATION_REMINDER_7DAYS', 'CONTRACT', 'd0000000-0000-0000-0000-000000000006',
     'Nhắc gia hạn hợp đồng thuê kho #CTR-2026-1006 (Còn 7 ngày)', 'Hợp đồng của quý khách sẽ hết hạn vào ngày 01/07/2026. Quý khách vui lòng gia hạn trực tuyến để duy trì quyền truy cập kho.', 'SENT'),

    ('44440000-0000-0000-0000-000000000008', '2026-06-28 09:00:00', NOW(), 'cd45b91a-5267-4478-aa59-f6f37e678344', 'customer@gmail.com', 'System Customer', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'EMAIL',
     'EXPIRATION_REMINDER_3DAYS', 'CONTRACT', 'd0000000-0000-0000-0000-000000000006',
     'Cảnh báo hết hạn hợp đồng thuê kho #B-203 (Còn 3 ngày cuối)', 'Sau ngày 01/07/2026, mã PIN điện tử sẽ tạm ngắt kết nối theo quy định quản lý buồng kho.', 'SENT'),

    ('44440000-0000-0000-0000-000000000009', '2026-07-01 09:25:00', NOW(), 'afc5e388-0c32-40f2-b909-4df9837d2253', 'ledangnguyena6@gmail.com', 'nguyen', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'EMAIL',
     'BOOKING_CONFIRMED', 'BOOKING', 'c0000000-0000-0000-0000-000000000007',
     'Đăng ký thuê kho #C-102 thành công tại Boxora Thủ Đức', 'Buồng kho cá nhân 3m² của bạn đã sẵn sàng bàn giao.', 'SENT'),

    ('44440000-0000-0000-0000-000000000010', '2026-07-15 11:10:00', NOW(), 'e4048fe9-bbc6-4b41-8f93-bd8e7b73e7a0', 'shelfyorganization@gmail.com', 'shelfy', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'EMAIL',
     'PAYMENT_SUCCESS', 'PAYMENT', 'f0000000-0000-0000-0000-000000000010',
     'Xác nhận hóa đơn chuyển khoản thuê kho thương mại #C-104', 'Kho diện tích 12m² đã được cấp mã truy cập thông minh.', 'SENT'),

    ('44440000-0000-0000-0000-000000000011', '2026-08-01 08:40:00', NOW(), '2e398528-931b-4d06-bcd7-5a1d6424aeab', 'ledangnguyena1@gmail.com', 'nguyen', 'a1111111-2222-3333-4444-555555555555', 'EMAIL',
     'BOOKING_CONFIRMED', 'BOOKING', 'c0000000-0000-0000-0000-000000000009',
     'Chào mừng quý khách đến cơ sở Tân Bình Mega Hub', 'Đơn đặt kho #BX-2026-1009 của quý khách đã được ghi nhận vào hệ thống.', 'SENT'),

    ('44440000-0000-0000-0000-000000000012', '2026-08-15 14:10:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'a1111111-2222-3333-4444-555555555555', 'EMAIL',
     'PAYMENT_SUCCESS', 'PAYMENT', 'f0000000-0000-0000-0000-000000000012',
     'Thanh toán hoàn tất kho hàng lớn #D-104', 'Kích hoạt thành công hợp đồng thuê 6 tháng với ưu đãi chiết khấu 10%.', 'SENT'),

    ('44440000-0000-0000-0000-000000000013', '2026-08-25 10:05:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'PAYMENT_SUCCESS', 'RENEWAL', 'f0000000-0000-0000-0000-000000000013',
     'Gia hạn hợp đồng thành công thêm 3 tháng kho #A-102', 'Thời hạn hợp đồng mới kéo dài đến 01/12/2026. Mã PIN cũ tiếp tục có hiệu lực.', 'SENT'),

    ('44440000-0000-0000-0000-000000000014', NOW() - INTERVAL '1 day', NOW(), 'e0000000-0000-0000-0000-000000000008', 'hoangyen.le@gmail.com', 'Lê Thị Hoàng Yến', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'BOOKING_CONFIRMED', 'BOOKING', 'c0000000-0000-0000-0000-000000000011',
     'Nhắc lịch bàn giao nhận kho #A-202 vào ngày mai', 'Quý khách vui lòng mang theo CCCD bản gốc để nhân viên quầy hoàn tất thủ tục bàn giao.', 'SENT'),

    ('44440000-0000-0000-0000-000000000015', '2025-12-05 16:35:00', NOW(), 'afc5e388-0c32-40f2-b909-4df9837d2253', 'ledangnguyena6@gmail.com', 'nguyen', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'EMAIL',
     'PAYMENT_SUCCESS', 'REFUND', 'f0000000-0000-0000-0000-000000000019',
     'Hoàn trả tiền đặt cọc 450.000₫ thành công', 'Khoản tiền đặt cọc buồng kho #C-101 đã được hoàn về tài khoản ngân hàng của quý khách.', 'SENT')
ON CONFLICT (id) DO NOTHING;
