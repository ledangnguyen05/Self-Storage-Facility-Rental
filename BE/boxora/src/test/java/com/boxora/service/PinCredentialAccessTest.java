package com.boxora.service;

import com.boxora.entity.Booking;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.BookingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The plain PIN and QR token of a rented unit belong to the customer. Front-desk staff, facility managers, business
 * managers and admins get the PIN once, in the check-in response, and cannot read it back through the booking API.
 */
@ExtendWith(MockitoExtension.class)
class PinCredentialAccessTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private UserRepository userRepository;
    @Mock private RequestContext requestContext;
    @Mock private EncryptionService encryptionService;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private ActivityLogService activityLogService;

    @InjectMocks
    private BookingServiceImpl bookingService;

    private UUID bookingId;
    private Booking booking;
    private User owner;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        owner = user("CUSTOMER", "owner@example.com");
        booking = Booking.builder()
                .customer(owner)
                .bookingCode("BX-PIN")
                .status(BookingStatus.ACTIVE)
                .accessPin("ENCRYPTED")
                .qrAccessToken("QR-TEST")
                .build();
        booking.setId(bookingId);
        lenient().when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        lenient().when(encryptionService.decrypt("ENCRYPTED")).thenReturn("123456");
    }

    private User user(String role, String email) {
        User user = User.builder().fullName(role).email(email).role(Role.builder().name(role).build()).build();
        user.setId(UUID.randomUUID());
        lenient().when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        lenient().when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    @DisplayName("Nhân viên, quản lý cơ sở, quản lý kinh doanh và quản trị không đọc lại được mã PIN / QR của khách")
    void staffRolesCannotReadThePlainCredentials() {
        for (String role : new String[]{"STAFF", "FACILITY_MANAGER", "BUSINESS_MANAGER", "ADMIN"}) {
            User actor = user(role, role.toLowerCase() + "@example.com");
            when(requestContext.currentUserId()).thenReturn(actor.getId());

            AppException credentials = assertThrows(AppException.class, () -> bookingService.getAccessCredentials(bookingId));
            assertThat(credentials.getErrorCode()).as(role).isEqualTo(ErrorCode.FORBIDDEN);

            AppException pin = assertThrows(AppException.class, () -> bookingService.getBookingPin(bookingId, actor.getEmail()));
            assertThat(pin.getErrorCode()).as(role).isEqualTo(ErrorCode.FORBIDDEN);
        }
        verify(encryptionService, never()).decrypt(anyString());
    }

    @Test
    @DisplayName("Khách thuê kho vẫn xem được mã của chính mình")
    void theOwningCustomerStillReadsTheirCredentials() {
        when(requestContext.currentUserId()).thenReturn(owner.getId());

        assertThat(bookingService.getAccessCredentials(bookingId).getAccessPin()).isEqualTo("123456");
        assertThat(bookingService.getBookingPin(bookingId, owner.getEmail()).getPin()).isEqualTo("123456");
    }

    @Test
    @DisplayName("Khách khác vẫn bị chặn")
    void anotherCustomerIsStillRefused() {
        User other = user("CUSTOMER", "other@example.com");
        when(requestContext.currentUserId()).thenReturn(other.getId());

        AppException ex = assertThrows(AppException.class, () -> bookingService.getAccessCredentials(bookingId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }
}
