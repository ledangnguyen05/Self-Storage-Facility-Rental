-- =========================================================================
-- V62: Mã cơ sở và mã kho là duy nhất KHÔNG phân biệt hoa thường.
--
-- Trước đây uc_facilities_code chỉ duy nhất theo đúng chữ hoa/thường ("QA-KT16211" và "qa-kt16211" cùng tồn tại) và bảng
-- storage_units không có ràng buộc duy nhất nào cho mã kho trong một cơ sở, nên hai người cùng tạo "D1-QA01" / "d1-qa01"
-- cho ra hai kho trùng mã. Service đã kiểm tra trước khi ghi; chỉ mục này là lớp chặn cuối cùng khi hai yêu cầu chạy song song.
-- V61 đã đổi mã các bản ghi trùng có sẵn, nên ở đây tạo chỉ mục luôn thành công; nếu vẫn còn trùng (dữ liệu thêm giữa hai bước)
-- thì bỏ qua và ghi NOTICE, tránh làm hỏng việc khởi động hệ thống.
-- =========================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM facilities GROUP BY LOWER(code) HAVING COUNT(*) > 1) THEN
        RAISE NOTICE 'Bỏ qua uk_facilities_code_lower: vẫn còn mã cơ sở trùng nhau khi không phân biệt hoa thường.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uk_facilities_code_lower ON facilities (LOWER(code));
    END IF;

    IF EXISTS (SELECT 1 FROM storage_units GROUP BY facility_id, LOWER(unit_code) HAVING COUNT(*) > 1) THEN
        RAISE NOTICE 'Bỏ qua uk_storage_units_facility_code_lower: vẫn còn mã kho trùng nhau trong một cơ sở.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uk_storage_units_facility_code_lower ON storage_units (facility_id, LOWER(unit_code));
    END IF;
END $$;
