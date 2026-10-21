package com.boxora.service;

import com.boxora.entity.Facility;
import com.boxora.enums.FacilityStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;

/**
 * Quy tắc cơ sở dùng chung: chỉ cơ sở đang hoạt động ({@link FacilityStatus#ACTIVE}) mới nhận đặt kho mới.
 * Giao diện đã ẩn kho của cơ sở bảo trì hoặc ngừng hoạt động, nhưng máy chủ phải tự chặn vì ai biết mã kho đều gọi
 * được API báo giá và đặt kho. Báo giá ({@code PricingService}) và tạo đặt kho ({@code BookingService}) cùng gọi
 * {@link #assertAcceptsBookings(Facility)}.
 */
public final class FacilityRules {

    private FacilityRules() {
    }

    /** {@code true} khi cơ sở nhận đặt kho mới. Kho không gắn cơ sở (dữ liệu cũ) không bị chặn ở đây. */
    public static boolean acceptsBookings(Facility facility) {
        return facility == null || facility.getStatus() == null || facility.getStatus() == FacilityStatus.ACTIVE;
    }

    /**
     * @throws AppException {@link ErrorCode#FACILITY_NOT_ACCEPTING_BOOKINGS} (409) kèm lý do bằng tiếng Việt
     *                      khi cơ sở đang bảo trì hoặc đã ngừng hoạt động
     */
    public static void assertAcceptsBookings(Facility facility) {
        if (acceptsBookings(facility)) {
            return;
        }
        String name = facility.getName() != null && !facility.getName().isBlank() ? facility.getName().trim() : "Cơ sở này";
        String reason = facility.getStatus() == FacilityStatus.MAINTENANCE
                ? name + " đang bảo trì nên tạm thời chưa nhận đặt kho. Vui lòng chọn cơ sở khác hoặc quay lại sau."
                : name + " đã ngừng hoạt động nên không nhận đặt kho. Vui lòng chọn cơ sở khác.";
        throw new AppException(ErrorCode.FACILITY_NOT_ACCEPTING_BOOKINGS, reason);
    }
}
