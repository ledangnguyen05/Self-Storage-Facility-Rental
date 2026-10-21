package com.boxora.service;

import com.boxora.entity.Facility;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UnitAvailabilityTest {

    @Test
    @DisplayName("A unit recorded AVAILABLE with no live booking stays AVAILABLE")
    void availableStaysAvailable() {
        assertThat(UnitAvailability.effectiveStatus(UnitStatus.AVAILABLE, List.of())).isEqualTo(UnitStatus.AVAILABLE);
        assertThat(UnitAvailability.effectiveStatus(UnitStatus.AVAILABLE, null)).isEqualTo(UnitStatus.AVAILABLE);
        assertThat(UnitAvailability.effectiveStatus(null, null)).isEqualTo(UnitStatus.AVAILABLE);
    }

    @Test
    @DisplayName("Pending approval, pending payment and confirmed bookings reserve the unit")
    void holdingBookingsReserve() {
        for (BookingStatus status : List.of(BookingStatus.PENDING_APPROVAL, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED)) {
            assertThat(UnitAvailability.effectiveStatus(UnitStatus.AVAILABLE, List.of(status))).isEqualTo(UnitStatus.RESERVED);
        }
    }

    @Test
    @DisplayName("Running bookings make the unit occupied and an overdue booking locks it")
    void runningBookingsOccupy() {
        for (BookingStatus status : List.of(BookingStatus.ACTIVE, BookingStatus.CHECKOUT_REQUESTED, BookingStatus.INSPECTED)) {
            assertThat(UnitAvailability.effectiveStatus(UnitStatus.AVAILABLE, List.of(status))).isEqualTo(UnitStatus.OCCUPIED);
        }
        assertThat(UnitAvailability.effectiveStatus(UnitStatus.AVAILABLE, List.of(BookingStatus.OVERDUE))).isEqualTo(UnitStatus.OVERDUE_LOCKED);
    }

    @Test
    @DisplayName("Finished bookings never hold a unit")
    void endedBookingsDoNotHold() {
        assertThat(UnitAvailability.effectiveStatus(UnitStatus.AVAILABLE, List.of(BookingStatus.COMPLETED, BookingStatus.CANCELLED)))
                .isEqualTo(UnitStatus.AVAILABLE);
        assertThat(UnitAvailability.statusImpliedBy(BookingStatus.CANCELLED)).isNull();
    }

    @Test
    @DisplayName("The strongest live booking wins and units in any other recorded status are left alone")
    void strongestWinsAndOtherStatusesUntouched() {
        assertThat(UnitAvailability.effectiveStatus(UnitStatus.AVAILABLE,
                List.of(BookingStatus.CONFIRMED, BookingStatus.ACTIVE))).isEqualTo(UnitStatus.OCCUPIED);
        assertThat(UnitAvailability.effectiveStatus(UnitStatus.UNDER_MAINTENANCE, List.of(BookingStatus.CONFIRMED)))
                .isEqualTo(UnitStatus.UNDER_MAINTENANCE);
        assertThat(UnitAvailability.effectiveStatus(UnitStatus.OCCUPIED, List.of(BookingStatus.CONFIRMED))).isEqualTo(UnitStatus.OCCUPIED);
    }

    private static Facility facility(FacilityStatus status) {
        return Facility.builder().name("Boxora Quận 1").code("HCM-D1").address("123 Nguyễn Huệ").status(status).build();
    }

    @Test
    @DisplayName("Only an ACTIVE facility accepts new bookings")
    void onlyActiveFacilityAcceptsBookings() {
        assertThat(FacilityRules.acceptsBookings(facility(FacilityStatus.ACTIVE))).isTrue();
        assertThat(FacilityRules.acceptsBookings(facility(FacilityStatus.MAINTENANCE))).isFalse();
        assertThat(FacilityRules.acceptsBookings(facility(FacilityStatus.INACTIVE))).isFalse();
        assertDoesNotThrow(() -> FacilityRules.assertAcceptsBookings(facility(FacilityStatus.ACTIVE)));
        assertDoesNotThrow(() -> FacilityRules.assertAcceptsBookings(null));
    }

    @Test
    @DisplayName("A refused facility explains why in Vietnamese and names the facility, without leaking an enum code")
    void refusalMessagesAreHuman() {
        AppException maintenance = assertThrows(AppException.class,
                () -> FacilityRules.assertAcceptsBookings(facility(FacilityStatus.MAINTENANCE)));
        assertThat(maintenance.getErrorCode()).isEqualTo(ErrorCode.FACILITY_NOT_ACCEPTING_BOOKINGS);
        assertThat(maintenance.getMessage()).contains("Boxora Quận 1").contains("đang bảo trì").doesNotContain("MAINTENANCE");

        AppException inactive = assertThrows(AppException.class,
                () -> FacilityRules.assertAcceptsBookings(facility(FacilityStatus.INACTIVE)));
        assertThat(inactive.getMessage()).contains("ngừng hoạt động").doesNotContain("INACTIVE");
    }

    @Test
    @DisplayName("Every unit status has a Vietnamese label and none leaks the enum code")
    void labelsAreVietnamese() {
        for (UnitStatus status : UnitStatus.values()) {
            String label = UnitAvailability.label(status);
            assertThat(label).isNotBlank().doesNotContain("_").isNotEqualTo(status.name());
        }
        assertThat(UnitAvailability.label(UnitStatus.AVAILABLE)).isEqualTo("Sẵn sàng");
        assertThat(UnitAvailability.label(UnitStatus.UNDER_MAINTENANCE)).isEqualTo("Đang bảo trì");
        assertThat(UnitAvailability.label(null)).isEqualTo("Không xác định");
    }
}
