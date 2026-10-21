-- =========================================================================
-- V47: Ngăn chặn tên loại kho và tên cơ sở trùng lặp (không phân biệt hoa thường).
--
-- Nguyên nhân gốc của lỗi "loại kho trùng" là bảng unit_types không có ràng buộc duy nhất cho type_name
-- (xem V45), còn facilities chỉ duy nhất theo code. Index chỉ được tạo khi dữ liệu hiện tại chưa có tên trùng,
-- nếu có thì bỏ qua và ghi NOTICE để người vận hành xử lý rồi tạo lại, tránh làm hỏng việc khởi động hệ thống.
-- =========================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM unit_types GROUP BY LOWER(type_name) HAVING COUNT(*) > 1) THEN
        RAISE NOTICE 'Bỏ qua uk_unit_types_type_name_lower: vẫn còn loại kho trùng tên, hãy gộp rồi tạo lại index.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uk_unit_types_type_name_lower ON unit_types (LOWER(type_name));
    END IF;

    IF EXISTS (SELECT 1 FROM facilities GROUP BY LOWER(name) HAVING COUNT(*) > 1) THEN
        RAISE NOTICE 'Bỏ qua uk_facilities_name_lower: vẫn còn cơ sở trùng tên, hãy đổi tên rồi tạo lại index.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uk_facilities_name_lower ON facilities (LOWER(name));
    END IF;
END $$;
