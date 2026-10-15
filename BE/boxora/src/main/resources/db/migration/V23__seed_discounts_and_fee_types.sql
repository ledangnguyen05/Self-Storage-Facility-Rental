-- =========================================================================
-- V23: Seed Discounts and Fee Types
-- =========================================================================

-- 1. Fee Types (Phí dịch vụ, phí vệ sinh, mất chìa khóa, bồi thường hư hỏng, quá hạn)
INSERT INTO fee_types (id, created_at, updated_at, code, name, description, default_amount, fee_category, is_recurring, is_active)
VALUES
    ('88880000-0000-0000-0000-000000000001', NOW(), NOW(), 'FEE_LATE_DAILY', 'Phí phạt quá hạn theo ngày', 'Phạt quá hạn thanh toán tiền thuê theo quy định hợp đồng', 50000.00, 'LATE_PENALTY', FALSE, TRUE),
    ('88880000-0000-0000-0000-000000000002', NOW(), NOW(), 'FEE_OVERDUE_LOCK', 'Phí kích hoạt lại quyền truy cập', 'Phí mở khóa truy cập IoT sau khi bị khóa do chậm thanh toán', 100000.00, 'OVERDUE_STORAGE', FALSE, TRUE),
    ('88880000-0000-0000-0000-000000000003', NOW(), NOW(), 'FEE_SEAL_OPERATION', 'Phí xử lý niêm phong kho', 'Chi phí niêm phong và bảo toàn tài sản vi phạm quá hạn (+7 ngày theo BR-RULE-012)', 200000.00, 'OVERDUE_STORAGE', FALSE, TRUE),
    ('88880000-0000-0000-0000-000000000004', NOW(), NOW(), 'FEE_CLEAN_STANDARD', 'Phí vệ sinh kho cơ bản', 'Áp dụng khi khách trả kho không dọn sạch rác hoặc bụi bẩn thông thường', 150000.00, 'CLEANING', FALSE, TRUE),
    ('88880000-0000-0000-0000-000000000005', NOW(), NOW(), 'FEE_CLEAN_HEAVY', 'Phí tẩy rửa mùi hôi & hóa chất', 'Áp dụng khi kho bị bám bẩn nặng, dầu mỡ, hóa chất hoặc mùi khó chịu', 350000.00, 'CLEANING', FALSE, TRUE),
    ('88880000-0000-0000-0000-000000000006', NOW(), NOW(), 'FEE_SMARTLOCK_KEY', 'Phí thay mới ổ khóa thông minh IoT', 'Bồi thường khi khách làm hỏng hoặc mất thiết bị khóa thông minh', 500000.00, 'KEY_REPLACEMENT', FALSE, TRUE),
    ('88880000-0000-0000-0000-000000000007', NOW(), NOW(), 'FEE_INSURANCE_BASIC', 'Phí bảo hiểm phòng chống cháy nổ cơ bản', 'Bảo hiểm tài sản lưu trữ tiêu chuẩn trị giá bồi thường đến 50.000.000 đ', 50000.00, 'INSURANCE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. Discounts (Mã giảm giá, chiết khấu dài hạn, voucher chào mừng)
INSERT INTO discounts (id, created_at, updated_at, code, name, description, discount_type, discount_value, min_rental_months, max_discount_amount, start_date, end_date, usage_limit, used_count, facility_id, is_active)
VALUES
    ('99990000-0000-0000-0000-000000000001', NOW(), NOW(), 'DISCOUNT_3M', 'Chiết khấu trả trước 3 tháng', 'Giảm 5% tổng phí thuê khi ký hợp đồng từ 3 tháng trở lên', 'PERCENTAGE', 5.00, 3, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', NULL, 0, NULL, TRUE),
    ('99990000-0000-0000-0000-000000000002', NOW(), NOW(), 'DISCOUNT_6M', 'Chiết khấu trả trước 6 tháng', 'Giảm 10% tổng phí thuê khi thanh toán trọn gói 6 tháng', 'PERCENTAGE', 10.00, 6, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', NULL, 0, NULL, TRUE),
    ('99990000-0000-0000-0000-000000000003', NOW(), NOW(), 'DISCOUNT_12M', 'Chiết khấu khách VIP 12 tháng', 'Giảm 15% tổng phí thuê cho hợp đồng thuê kho dài hạn 1 năm', 'PERCENTAGE', 15.00, 12, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', NULL, 0, NULL, TRUE),
    ('99990000-0000-0000-0000-000000000004', NOW(), NOW(), 'BOXORA_WELCOME', 'Voucher Chào Mừng Khách Hàng Mới', 'Giảm trực tiếp 100.000 VNĐ cho đơn đặt chỗ đầu tiên qua ứng dụng', 'FIXED_AMOUNT', 100000.00, 1, 100000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 500, 12, NULL, TRUE),
    ('99990000-0000-0000-0000-000000000005', NOW(), NOW(), 'SUMMER_MEGA_SALE', 'Khuyến Mãi Mùa Hè - Mega Storage', 'Giảm 8% cho kho diện tích lớn trên 10m2', 'PERCENTAGE', 8.00, 2, 500000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months', 200, 5, NULL, TRUE)
ON CONFLICT (code) DO NOTHING;
