-- =========================================================================
-- V45: Gộp các loại kho trùng lặp do seed cũ (V6 tạo bằng UUID ngẫu nhiên, V8/V13 tạo lại cùng loại với id cố định).
--
-- Mỗi loại kho "cũ" (không còn kho nào thuộc về) được gộp vào loại kho chính cùng kích thước và diện tích:
--   * bảng giá riêng của cơ sở (facility_policy_prices) và lịch sử giá được chuyển sang loại kho chính;
--   * sau đó mới xóa loại kho cũ, nên không mất dữ liệu và không vi phạm khóa ngoại.
-- Chỉ động vào loại kho không có kho nào; loại kho đang có kho luôn được giữ nguyên.
-- =========================================================================

DO $$
DECLARE
    legacy      RECORD;
    canonical   UUID;
BEGIN
    FOR legacy IN
        SELECT ut.id, ut.dimensions, ut.area_sqm
        FROM unit_types ut
        WHERE ut.type_name IN (
                'Personal Locker (Mini Box)',
                'Compact Studio Unit',
                'Standard 1-Bedroom Storage',
                'Commercial & E-Commerce Suite')
          AND NOT EXISTS (SELECT 1 FROM storage_units su WHERE su.unit_type_id = ut.id)
    LOOP
        -- Loại kho chính: cùng kích thước và diện tích, đang có kho
        SELECT c.id INTO canonical
        FROM unit_types c
        WHERE c.id <> legacy.id
          AND c.dimensions = legacy.dimensions
          AND c.area_sqm = legacy.area_sqm
          AND EXISTS (SELECT 1 FROM storage_units su WHERE su.unit_type_id = c.id)
        ORDER BY c.created_at
        LIMIT 1;

        IF canonical IS NULL THEN
            CONTINUE;
        END IF;

        -- Bảng giá riêng của cơ sở: chuyển sang loại kho chính nếu cơ sở chưa có dòng giá cho loại đó
        UPDATE facility_policy_prices p
        SET unit_type_id = canonical
        WHERE p.unit_type_id = legacy.id
          AND NOT EXISTS (
                SELECT 1 FROM facility_policy_prices x
                WHERE x.facility_policy_id = p.facility_policy_id AND x.unit_type_id = canonical);

        DELETE FROM facility_policy_prices WHERE unit_type_id = legacy.id;

        -- Lịch sử giá: giữ lại, chuyển sang loại kho chính
        UPDATE storage_unit_price_histories SET unit_type_id = canonical WHERE unit_type_id = legacy.id;

        DELETE FROM unit_types WHERE id = legacy.id;
    END LOOP;
END $$;
