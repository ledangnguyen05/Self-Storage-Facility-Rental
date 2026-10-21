-- =========================================================================
-- V61: Sửa dữ liệu kho bị lệch (chạy trước V62 là bước thêm ràng buộc duy nhất).
--
-- 1) Trạng thái kho lệch với đặt kho. Dữ liệu mẫu có kho ghi "AVAILABLE" dù đã có đặt kho còn hiệu lực (ví dụ D1-A101 với
--    BX-2026-1014 đang chờ thanh toán, D7-A101 với BX-2026-1015 đã xác nhận). Kho đó bị mời đặt trên trang "Thuê kho" nhưng đặt thì
--    bị từ chối (409), và làm tăng ảo số "Kho trống". Đưa trạng thái kho về đúng với đặt kho còn hiệu lực:
--      OVERDUE                                  -> OVERDUE_LOCKED
--      ACTIVE / CHECKOUT_REQUESTED / INSPECTED  -> OCCUPIED
--      PENDING_APPROVAL / PENDING_PAYMENT / CONFIRMED -> RESERVED
--    Mức mạnh nhất thắng; chỉ đụng tới kho đang ghi AVAILABLE nên không ghi đè kho bảo trì hay kho đã đúng trạng thái.
--
-- 2) Tên tầng lẫn lộn ("Floor 1" / "Tầng 1" / "Tang 1"...) làm bộ lọc tầng bị tách đôi và mỗi nửa chỉ có một phần kho.
--    Chuẩn hóa về "Tầng N" (và "Hầm N" cho tầng hầm).
--
-- 3) Mã cơ sở / mã kho trùng nhau khi không phân biệt hoa thường (ví dụ "QA-KT16211" và "qa-kt16211"). Bản ghi tạo sau được thêm
--    hậu tố "-D<n>" để V62 tạo được chỉ mục duy nhất mà không mất dữ liệu.
--
-- 4) Địa chỉ cơ sở mẫu viết tiếng Anh không dấu ("123 Nguyen Hue, Ben Nghe Ward") trong giao diện tiếng Việt. Chỉ sửa đúng các dòng còn
--    nguyên giá trị mẫu (WHERE khớp địa chỉ cũ), nên địa chỉ do người dùng đã chỉnh sẽ không bị ghi đè. Mã cơ sở giữ nguyên vì nhiều nơi
--    tham chiếu; tên cơ sở mẫu được Việt hóa ở bước 5.
-- =========================================================================

-- 1) Trạng thái kho theo đặt kho còn hiệu lực
UPDATE storage_units su
SET status = 'OVERDUE_LOCKED'
WHERE su.status = 'AVAILABLE'
  AND EXISTS (SELECT 1 FROM bookings b WHERE b.storage_unit_id = su.id AND b.status = 'OVERDUE');

UPDATE storage_units su
SET status = 'OCCUPIED'
WHERE su.status = 'AVAILABLE'
  AND EXISTS (SELECT 1 FROM bookings b
              WHERE b.storage_unit_id = su.id AND b.status IN ('ACTIVE', 'CHECKOUT_REQUESTED', 'INSPECTED'));

UPDATE storage_units su
SET status = 'RESERVED'
WHERE su.status = 'AVAILABLE'
  AND EXISTS (SELECT 1 FROM bookings b
              WHERE b.storage_unit_id = su.id AND b.status IN ('PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED'));

-- 2) Tên tầng về một dạng duy nhất
UPDATE storage_units
SET floor_level = 'Hầm ' || (REGEXP_MATCH(floor_level, '[0-9]+'))[1]::int
WHERE floor_level ~* '^\s*(basement|hầm|ham|b)\s*\.?\s*[0-9]+\s*$';

UPDATE storage_units
SET floor_level = 'Tầng ' || (REGEXP_MATCH(floor_level, '[0-9]+'))[1]::int
WHERE floor_level ~* '^\s*(floor|tầng|tang|level|lầu|lau|f|l)\s*\.?\s*[0-9]+\s*$'
  AND floor_level IS DISTINCT FROM 'Tầng ' || (REGEXP_MATCH(floor_level, '[0-9]+'))[1]::int;

-- 3) Mã trùng khi không phân biệt hoa thường: giữ bản ghi cũ nhất, đổi mã các bản ghi sau
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(code) ORDER BY created_at, id) AS rn
    FROM facilities
)
UPDATE facilities f
SET code = LEFT(f.code, 26) || '-D' || ranked.rn
FROM ranked
WHERE f.id = ranked.id
  AND ranked.rn > 1;

WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY facility_id, LOWER(unit_code) ORDER BY created_at, id) AS rn
    FROM storage_units
)
UPDATE storage_units su
SET unit_code = LEFT(su.unit_code, 26) || '-D' || ranked.rn
FROM ranked
WHERE su.id = ranked.id
  AND ranked.rn > 1;

-- 4) Địa chỉ cơ sở mẫu có dấu (chỉ khi còn đúng giá trị mẫu ban đầu)
UPDATE facilities
SET address = '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1'
WHERE code = 'HCM-D1' AND address = '123 Nguyen Hue, Ben Nghe Ward';

UPDATE facilities
SET address = '456 Nguyễn Hữu Thọ, Phường Tân Hưng, Quận 7'
WHERE code = 'HCM-D7' AND address = '456 Nguyen Huu Tho, Tan Hung Ward';

UPDATE facilities
SET address = '789 Võ Văn Ngân, Phường Linh Chiểu, Thành phố Thủ Đức'
WHERE code = 'HCM-TD' AND address = '789 Vo Van Ngan, Linh Chieu Ward';

UPDATE facilities
SET address = '102 Trường Sơn, Phường 2, Quận Tân Bình'
WHERE code = 'HCM-TB' AND address = '102 Truong Son, Ward 2, Tan Binh District';

UPDATE facilities
SET city = 'TP. Hồ Chí Minh'
WHERE code IN ('HCM-D1', 'HCM-D7', 'HCM-TD', 'HCM-TB') AND city = 'Ho Chi Minh City';

-- 5) Tên cơ sở mẫu viết tiếng Anh ("Boxora District 1") trong giao diện tiếng Việt, lệch với chân trang ("Boxora Quận 1").
--    Chỉ đổi đúng các dòng còn nguyên tên mẫu và khi tên tiếng Việt chưa bị cơ sở nào khác dùng (tên cơ sở là duy nhất).
--    Mã cơ sở (HCM-D1...) không đổi.
UPDATE facilities f
SET name = 'Boxora Quận 1'
WHERE f.code = 'HCM-D1' AND f.name = 'Boxora District 1'
  AND NOT EXISTS (SELECT 1 FROM facilities o WHERE LOWER(o.name) = LOWER('Boxora Quận 1'));

UPDATE facilities f
SET name = 'Boxora Quận 7'
WHERE f.code = 'HCM-D7' AND f.name = 'Boxora District 7'
  AND NOT EXISTS (SELECT 1 FROM facilities o WHERE LOWER(o.name) = LOWER('Boxora Quận 7'));

UPDATE facilities f
SET name = 'Boxora Thủ Đức'
WHERE f.code = 'HCM-TD' AND f.name = 'Boxora Thu Duc'
  AND NOT EXISTS (SELECT 1 FROM facilities o WHERE LOWER(o.name) = LOWER('Boxora Thủ Đức'));

UPDATE facilities f
SET name = 'Boxora Tân Bình Mega Hub'
WHERE f.code = 'HCM-TB' AND f.name = 'Boxora Tan Binh Mega Hub'
  AND NOT EXISTS (SELECT 1 FROM facilities o WHERE LOWER(o.name) = LOWER('Boxora Tân Bình Mega Hub'));
