package com.boxora.security;

import com.boxora.controller.BookingController;
import com.boxora.dto.request.UpdatePinRequest;
import com.boxora.service.BookingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

/**
 * Reissuing a door PIN is for the tenant (own booking) and for facility managers / admins. A business manager must not
 * do it, even if their role was granted BOOKING_UPDATE.
 */
@SpringJUnitConfig(BookingPinReissueSecurityTest.Config.class)
class BookingPinReissueSecurityTest {

    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean
        BookingService bookingService() {
            return mock(BookingService.class);
        }

        @Bean
        BookingController bookingController(BookingService service) {
            return new BookingController(service);
        }
    }

    @Autowired
    private BookingController controller;

    private static UpdatePinRequest pin() {
        UpdatePinRequest request = new UpdatePinRequest();
        request.setNewPin("837297");
        return request;
    }

    @Test
    @WithMockUser(roles = "BUSINESS_MANAGER")
    @DisplayName("BUSINESS_MANAGER không được đổi mã PIN theo đơn hay theo kho")
    void businessManagerCannotReissuePin() {
        assertThrows(AccessDeniedException.class, () -> controller.updateBookingPin(UUID.randomUUID(), pin(), null));
        assertThrows(AccessDeniedException.class, () -> controller.updateBookingPinByUnit(UUID.randomUUID(), pin(), null));
    }

    @Test
    @WithMockUser(authorities = {"ROLE_BUSINESS_MANAGER", "BOOKING_UPDATE"})
    @DisplayName("Quyền BOOKING_UPDATE cấp thêm cho BUSINESS_MANAGER cũng không mở được việc đổi PIN")
    void bookingUpdateAuthorityDoesNotReopenIt() {
        assertThrows(AccessDeniedException.class, () -> controller.updateBookingPin(UUID.randomUUID(), pin(), null));
        assertThrows(AccessDeniedException.class, () -> controller.updateBookingPinByUnit(UUID.randomUUID(), pin(), null));
    }

    @Test
    @WithMockUser(roles = "FACILITY_MANAGER")
    @DisplayName("FACILITY_MANAGER đổi được mã PIN")
    void facilityManagerCanReissuePin() {
        assertDoesNotThrow(() -> controller.updateBookingPin(UUID.randomUUID(), pin(), null));
        assertDoesNotThrow(() -> controller.updateBookingPinByUnit(UUID.randomUUID(), pin(), null));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("ADMIN đổi được mã PIN")
    void adminCanReissuePin() {
        assertDoesNotThrow(() -> controller.updateBookingPin(UUID.randomUUID(), pin(), null));
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    @DisplayName("CUSTOMER tự đổi được mã PIN của mình (quyền sở hữu do service kiểm tra)")
    void customerCanReissueOwnPin() {
        assertDoesNotThrow(() -> controller.updateBookingPin(UUID.randomUUID(), pin(), null));
    }
}
