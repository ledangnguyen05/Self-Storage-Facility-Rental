package com.boxora.service;

import com.boxora.enums.BookingStatus;
import com.boxora.enums.UnitStatus;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;

/**
 * Trạng thái hiệu lực của kho. Cột {@code storage_units.status} là bản ghi vận hành, nhưng một kho đang có đặt kho còn
 * hiệu lực thì không bao giờ được hiển thị là "Sẵn sàng", kể cả khi dữ liệu cũ hoặc một thao tác trước đó để lệch trạng thái.
 * Danh sách kho, đếm kho trống, "giá từ" và báo giá đều dùng chung quy tắc này nên một kho đã có người giữ không được mời đặt.
 */
public final class UnitAvailability {

    /** Đặt kho đã kết thúc (hoàn tất hoặc hủy) không còn chiếm kho; mọi trạng thái khác là còn hiệu lực. */
    public static final Set<BookingStatus> ENDED_BOOKING_STATUSES = EnumSet.of(BookingStatus.COMPLETED, BookingStatus.CANCELLED);

    /** Đặt kho còn hiệu lực: đang chờ duyệt/thanh toán, giữ chỗ, đang thuê, đang trả kho hoặc quá hạn. */
    public static final Set<BookingStatus> LIVE_BOOKING_STATUSES = EnumSet.complementOf(EnumSet.copyOf(ENDED_BOOKING_STATUSES));

    private UnitAvailability() {
    }

    public static boolean isLive(BookingStatus status) {
        return status != null && LIVE_BOOKING_STATUSES.contains(status);
    }

    /** Trạng thái kho tương ứng với một đặt kho còn hiệu lực ({@code null} khi đặt kho đã kết thúc). */
    public static UnitStatus statusImpliedBy(BookingStatus booking) {
        if (!isLive(booking)) {
            return null;
        }
        return switch (booking) {
            case OVERDUE -> UnitStatus.OVERDUE_LOCKED;
            case ACTIVE, CHECKOUT_REQUESTED, INSPECTED -> UnitStatus.OCCUPIED;
            default -> UnitStatus.RESERVED;
        };
    }

    /**
     * Trạng thái hiệu lực của một kho: chỉ kho đang ghi {@code AVAILABLE} mới bị nâng lên khi còn đặt kho hiệu lực
     * (mức mạnh nhất thắng: khóa quá hạn &gt; đang thuê &gt; giữ chỗ). Mọi trạng thái khác giữ nguyên.
     */
    public static UnitStatus effectiveStatus(UnitStatus recorded, Collection<BookingStatus> liveBookings) {
        UnitStatus status = recorded != null ? recorded : UnitStatus.AVAILABLE;
        if (status != UnitStatus.AVAILABLE || liveBookings == null || liveBookings.isEmpty()) {
            return status;
        }
        UnitStatus strongest = UnitStatus.AVAILABLE;
        for (BookingStatus booking : liveBookings) {
            UnitStatus implied = statusImpliedBy(booking);
            if (implied != null && rank(implied) > rank(strongest)) {
                strongest = implied;
            }
        }
        return strongest;
    }

    private static int rank(UnitStatus status) {
        return switch (status) {
            case OVERDUE_LOCKED -> 3;
            case OCCUPIED -> 2;
            case RESERVED -> 1;
            default -> 0;
        };
    }

    /** Tên trạng thái kho bằng tiếng Việt cho thông điệp và nhật ký (không để lộ mã kỹ thuật như UNDER_MAINTENANCE). */
    public static String label(UnitStatus status) {
        if (status == null) {
            return "Không xác định";
        }
        return switch (status) {
            case AVAILABLE -> "Sẵn sàng";
            case RESERVED -> "Đã giữ chỗ";
            case OCCUPIED -> "Đang thuê";
            case OVERDUE_LOCKED -> "Khóa do quá hạn";
            case UNDER_MAINTENANCE -> "Đang bảo trì";
        };
    }
}
