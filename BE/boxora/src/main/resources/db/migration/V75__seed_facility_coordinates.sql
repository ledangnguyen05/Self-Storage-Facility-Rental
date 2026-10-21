-- =========================================================================
-- V46: Tọa độ GPS thật cho 4 cơ sở mẫu (HCM-D1, HCM-D7, HCM-TD, HCM-TB).
--
-- Cột latitude/longitude được thêm ở V30 nhưng chưa có dữ liệu, nên bản đồ, nút "Chỉ đường" và sắp xếp
-- "Gần bạn nhất" không có gì để hiển thị. Tọa độ dưới đây tra theo đúng địa chỉ trong seed V5
-- (OpenStreetMap / Nominatim), đủ chính xác để ghim đúng đoạn phố; quản lý có thể tinh chỉnh trong
-- Cấu hình chi nhánh.
--
-- Chỉ điền cho cơ sở CHƯA có tọa độ, nên không ghi đè tọa độ do quản lý đã nhập.
-- =========================================================================

UPDATE facilities
SET latitude = 10.7741300, longitude = 106.7033200, updated_at = CURRENT_TIMESTAMP
WHERE code = 'HCM-D1' AND latitude IS NULL AND longitude IS NULL;   -- 123 Nguyễn Huệ, P. Bến Nghé, Quận 1

UPDATE facilities
SET latitude = 10.7403952, longitude = 106.7008761, updated_at = CURRENT_TIMESTAMP
WHERE code = 'HCM-D7' AND latitude IS NULL AND longitude IS NULL;   -- 456 Nguyễn Hữu Thọ, P. Tân Hưng, Quận 7

UPDATE facilities
SET latitude = 10.8506094, longitude = 106.7591827, updated_at = CURRENT_TIMESTAMP
WHERE code = 'HCM-TD' AND latitude IS NULL AND longitude IS NULL;   -- 789 Võ Văn Ngân, P. Linh Chiểu, TP. Thủ Đức

UPDATE facilities
SET latitude = 10.8112000, longitude = 106.6668000, updated_at = CURRENT_TIMESTAMP
WHERE code = 'HCM-TB' AND latitude IS NULL AND longitude IS NULL;   -- 102 Trường Sơn, P.2, Quận Tân Bình
