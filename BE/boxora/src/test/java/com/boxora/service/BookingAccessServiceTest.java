package com.boxora.service;

import com.boxora.entity.Booking;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingAccessServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RequestContext requestContext;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @InjectMocks
    private BookingServiceImpl bookingService;

    private UUID customerId;
    private UUID bookingId;
    private Booking booking;

    @BeforeEach
    void setUp() {
        customerId = UUID.randomUUID();
        bookingId = UUID.randomUUID();
        User customer = User.builder().fullName("Customer").email("customer@example.com").build();
        customer.setId(customerId);
        booking = Booking.builder()
                .customer(customer)
                .bookingCode("BK-TEST")
                .status(BookingStatus.ACTIVE)
                .accessPin("123456")
                .qrAccessToken("QR-TEST")
                .build();
        booking.setId(bookingId);
    }

    @Test
    void myActiveReturnsOnlyPaidBookingsWithoutCredentials() {
        Booking pendingBooking = Booking.builder()
                .customer(booking.getCustomer())
                .bookingCode("BK-PENDING")
                .status(BookingStatus.PENDING_PAYMENT)
                .build();
        when(requestContext.currentUserId()).thenReturn(customerId);
        when(bookingRepository.findByCustomer_Id(customerId)).thenReturn(List.of(booking, pendingBooking));

        var results = bookingService.getMyActiveBookings(customerId);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getId()).isEqualTo(bookingId);
        assertThat(results.get(0).getAccessPin()).isNull();
        assertThat(results.get(0).getQrAccessToken()).isNull();
    }

    @Test
    void myActiveRejectsAnotherCustomerId() {
        when(requestContext.currentUserId()).thenReturn(customerId);

        AppException exception = assertThrows(AppException.class,
                () -> bookingService.getMyActiveBookings(UUID.randomUUID()));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void credentialsAreReturnedOnlyToTheOwningCustomer() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(requestContext.currentUserId()).thenReturn(customerId);

        var credentials = bookingService.getAccessCredentials(bookingId);

        assertThat(credentials.getAccessPin()).isEqualTo("123456");
        assertThat(credentials.getQrAccessToken()).isEqualTo("QR-TEST");
    }

    @Test
    void credentialsAreDeniedToOtherCustomers() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());

        AppException exception = assertThrows(AppException.class,
                () -> bookingService.getAccessCredentials(bookingId));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }
}
