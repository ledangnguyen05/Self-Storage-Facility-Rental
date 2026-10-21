package com.boxora.service.impl;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingPinResponse;
import com.boxora.dto.response.BookingResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.Payment;
import com.boxora.entity.RefundRequest;
import com.boxora.entity.RentalContract;
import com.boxora.entity.Role;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RefundStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RefundRequestRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EncryptionService;
import com.boxora.service.PricingService;
import com.boxora.service.StorageUnitLockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Round-2 QA: booking lists and decisions are staff-only and facility-scoped, staff bookings stay in their facility,
 * the receiving staff is validated, expired requests are reported, and the access PIN survives a move-out request.
 */
@ExtendWith(MockitoExtension.class)
class BookingStaffScopeAndDecisionTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private UserRepository userRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private StorageUnitLockService storageUnitLockService;
    @Mock private ActivityLogService activityLogService;
    @Mock private PaymentRepository paymentRepository;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private EncryptionService encryptionService;
    @Mock private PricingService pricingService;
    @Mock private RequestContext requestContext;
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private RefundRequestRepository refundRequestRepository;

    @InjectMocks
    private BookingServiceImpl bookingService;

    private Facility district1;
    private Facility district7;
    private StorageUnit unitD1;
    private User customer;

    @BeforeEach
    void setUp() {
        org.springframework.test.util.ReflectionTestUtils.setField(bookingService, "maxAdvanceDays", 30);
        district1 = Facility.builder().name("Boxora Quận 1").build();
        district1.setId(UUID.randomUUID());
        district7 = Facility.builder().name("Boxora Quận 7").build();
        district7.setId(UUID.randomUUID());
        unitD1 = StorageUnit.builder().unitCode("D1-A101").facility(district1).status(UnitStatus.RESERVED).build();
        unitD1.setId(UUID.randomUUID());
        customer = user("customer@gmail.com", "CUSTOMER", null);
    }

    private static User user(String email, String role, Facility facility) {
        User user = User.builder().email(email).fullName(email).role(Role.builder().name(role).build()).facility(facility).build();
        user.setId(UUID.randomUUID());
        return user;
    }

    private Booking booking(BookingStatus status, StorageUnit unit) {
        Booking booking = Booking.builder()
                .bookingCode("BX-2026-TEST01")
                .customer(customer)
                .storageUnit(unit)
                .status(status)
                .rentalMonths(1)
                .totalRentalFee(new BigDecimal("3200000"))
                .depositAmount(new BigDecimal("3200000"))
                .signingMethod("IN_PERSON")
                .build();
        booking.setId(UUID.randomUUID());
        return booking;
    }

    private void actingAs(String role) {
        lenient().when(requestContext.currentUserRole()).thenReturn(role);
    }

    // ------------------------------------------------------------------ staff-only lists

    @Test
    void customerCannotReadUpcomingArrivals() {
        actingAs("CUSTOMER");

        AppException error = assertThrows(AppException.class, () -> bookingService.getUpcomingArrivals());

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        verify(bookingRepository, never()).findAll();
    }

    @Test
    void customerCannotReadPendingApprovals() {
        actingAs("CUSTOMER");

        AppException error = assertThrows(AppException.class, () -> bookingService.getPendingApprovalRequests());

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        verify(bookingRepository, never()).findByStatusOrderByCreatedAtAsc(any());
    }

    @Test
    void staffArrivalsOnlyContainTheirFacility() {
        actingAs("STAFF");
        when(facilityAccessGuard.scopedFacilityIdOrNull()).thenReturn(district1.getId());
        StorageUnit unitD7 = StorageUnit.builder().unitCode("D7-A103").facility(district7).build();
        unitD7.setId(UUID.randomUUID());
        Booking mine = booking(BookingStatus.CONFIRMED, unitD1);
        Booking other = booking(BookingStatus.CONFIRMED, unitD7);
        when(bookingRepository.findAll()).thenReturn(List.of(mine, other));

        List<BookingResponse> arrivals = bookingService.getUpcomingArrivals();

        assertThat(arrivals).extracting(BookingResponse::getId).containsExactly(mine.getId());
    }

    @Test
    void staffAskingForACustomersBookingsOnlySeesTheirFacility() {
        User staff = user("staff1q1@gmail.com", "STAFF", district1);
        actingAs("STAFF");
        when(requestContext.currentUserId()).thenReturn(staff.getId());
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        when(facilityAccessGuard.scopedFacilityIdOrNull()).thenReturn(district1.getId());
        StorageUnit unitD7 = StorageUnit.builder().unitCode("D7-A103").facility(district7).build();
        unitD7.setId(UUID.randomUUID());
        Booking mine = booking(BookingStatus.ACTIVE, unitD1);
        Booking other = booking(BookingStatus.ACTIVE, unitD7);
        when(bookingRepository.findByCustomer_Id(customer.getId())).thenReturn(List.of(mine, other));

        List<BookingResponse> result = bookingService.getMyActiveBookings(customer.getId());

        assertThat(result).extracting(BookingResponse::getId).containsExactly(mine.getId());
    }

    // ------------------------------------------------------------------ createBooking

    @Test
    void staffCannotBookAUnitOfAnotherFacility() {
        actingAs("STAFF");
        StorageUnit unitD7 = StorageUnit.builder().unitCode("D7-A103").facility(district7).status(UnitStatus.AVAILABLE).build();
        unitD7.setId(UUID.randomUUID());
        when(storageUnitRepository.findWithDetailsByIdForUpdate(unitD7.getId())).thenReturn(Optional.of(unitD7));
        doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED)).when(facilityAccessGuard).checkFacilityAccess(district7.getId());

        AppException error = assertThrows(AppException.class, () -> bookingService.createBooking(BookingCreateRequest.builder()
                .storageUnitId(unitD7.getId()).customerId(customer.getId()).startDate(LocalDate.now().plusDays(4))
                .rentalMonths(1).signingMethod("IN_PERSON").build()));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
        assertThat(unitD7.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void noBookingInAFacilityUnderMaintenance() {
        actingAs("CUSTOMER");
        district1.setStatus(FacilityStatus.MAINTENANCE);
        unitD1.setStatus(UnitStatus.AVAILABLE);
        when(storageUnitRepository.findWithDetailsByIdForUpdate(unitD1.getId())).thenReturn(Optional.of(unitD1));

        AppException error = assertThrows(AppException.class, () -> bookingService.createBooking(BookingCreateRequest.builder()
                .storageUnitId(unitD1.getId()).startDate(LocalDate.now().plusDays(1)).rentalMonths(1).build()));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.BOOKING_FACILITY_NOT_OPERATING);
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void staffMustBookForARealCustomerAccount() {
        actingAs("STAFF");
        unitD1.setStatus(UnitStatus.AVAILABLE);
        when(storageUnitRepository.findWithDetailsByIdForUpdate(unitD1.getId())).thenReturn(Optional.of(unitD1));
        User otherStaff = user("staff2q1@gmail.com", "STAFF", district1);
        when(userRepository.findById(otherStaff.getId())).thenReturn(Optional.of(otherStaff));

        AppException missing = assertThrows(AppException.class, () -> bookingService.createBooking(BookingCreateRequest.builder()
                .storageUnitId(unitD1.getId()).startDate(LocalDate.now().plusDays(1)).rentalMonths(1).build()));
        AppException notCustomer = assertThrows(AppException.class, () -> bookingService.createBooking(BookingCreateRequest.builder()
                .storageUnitId(unitD1.getId()).customerId(otherStaff.getId()).startDate(LocalDate.now().plusDays(1)).rentalMonths(1).build()));

        assertThat(missing.getErrorCode()).isEqualTo(ErrorCode.BOOKING_CUSTOMER_REQUIRED);
        assertThat(notCustomer.getErrorCode()).isEqualTo(ErrorCode.BOOKING_CUSTOMER_REQUIRED);
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void counterBookingByStaffIsAnInPersonHoldAndUnknownMethodsAreNeverStored() {
        actingAs("STAFF");
        unitD1.setStatus(UnitStatus.AVAILABLE);
        when(storageUnitRepository.findWithDetailsByIdForUpdate(unitD1.getId())).thenReturn(Optional.of(unitD1));
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(pricingService.calculateQuote(any())).thenReturn(com.boxora.dto.response.PricingQuoteResponse.builder()
                .totalRentalFee(new BigDecimal("3200000")).depositAmount(new BigDecimal("3200000")).build());
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));

        BookingResponse counter = bookingService.createBooking(BookingCreateRequest.builder()
                .storageUnitId(unitD1.getId()).customerId(customer.getId()).startDate(LocalDate.now().plusDays(1))
                .rentalMonths(1).build());

        assertThat(counter.getSigningMethod()).isEqualTo("IN_PERSON");
        assertThat(counter.getStatus()).isEqualTo(BookingStatus.CONFIRMED);

        actingAs("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(customer.getId());
        unitD1.setStatus(UnitStatus.AVAILABLE);
        BookingResponse odd = bookingService.createBooking(BookingCreateRequest.builder()
                .storageUnitId(unitD1.getId()).startDate(LocalDate.now().plusDays(1)).rentalMonths(1).signingMethod("paper").build());

        assertThat(odd.getSigningMethod()).isEqualTo("ONLINE");
        assertThat(odd.getStatus()).isEqualTo(BookingStatus.PENDING_PAYMENT);
    }

    // ------------------------------------------------------------------ decision

    @Test
    void customerCannotDecideABookingRequest() {
        actingAs("CUSTOMER");

        AppException error = assertThrows(AppException.class,
                () -> bookingService.reviewBookingRequest(UUID.randomUUID(), true, null, null));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        verify(bookingRepository, never()).findById(any());
    }

    @Test
    void receivingStaffMustBeAnActiveStaffOfTheBookingsFacility() {
        actingAs("FACILITY_MANAGER");
        Booking booking = booking(BookingStatus.CONFIRMED, unitD1);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        User staffD7 = user("staff1q7@gmail.com", "STAFF", district7);
        User inactive = user("old@gmail.com", "STAFF", district1);
        inactive.setIsActive(false);
        UUID unknown = UUID.randomUUID();
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(userRepository.findById(staffD7.getId())).thenReturn(Optional.of(staffD7));
        when(userRepository.findById(inactive.getId())).thenReturn(Optional.of(inactive));
        when(userRepository.findById(unknown)).thenReturn(Optional.empty());

        for (UUID candidate : List.of(customer.getId(), staffD7.getId(), inactive.getId(), unknown)) {
            AppException error = assertThrows(AppException.class,
                    () -> bookingService.reviewBookingRequest(booking.getId(), true, candidate, "x"));
            assertThat(error.getErrorCode()).isEqualTo(ErrorCode.BOOKING_ASSIGNED_STAFF_INVALID);
        }
        assertThat(booking.getHandedOverByStaffId()).isNull();
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void validReceivingStaffIsAssigned() {
        actingAs("FACILITY_MANAGER");
        Booking booking = booking(BookingStatus.CONFIRMED, unitD1);
        User staff = user("staff1q1@gmail.com", "STAFF", district1);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(userRepository.findById(staff.getId())).thenReturn(Optional.of(staff));
        when(bookingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        BookingResponse response = bookingService.reviewBookingRequest(booking.getId(), true, staff.getId(), "Gọi trước 30 phút");

        assertThat(booking.getHandedOverByStaffId()).isEqualTo(staff.getId());
        assertThat(response.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
    }

    @Test
    void approvingAnExpiredRequestIsAConflictAndReleasesTheUnit() {
        actingAs("FACILITY_MANAGER");
        Booking booking = booking(BookingStatus.PENDING_APPROVAL, unitD1);
        booking.setPaymentExpiresAt(Instant.now().minusSeconds(300));
        RentalContract contract = RentalContract.builder().status(RentalContractStatus.PENDING_SIGNATURE).build();
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(rentalContractRepository.findByBookingId(booking.getId())).thenReturn(Optional.of(contract));

        AppException error = assertThrows(AppException.class,
                () -> bookingService.reviewBookingRequest(booking.getId(), true, null, null));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.BOOKING_REQUEST_EXPIRED);
        assertThat(error.getErrorCode().getHttpStatus().value()).isEqualTo(409);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
        assertThat(unitD1.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
        assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.CANCELLED);
    }

    @Test
    void requestWithoutDeadlineExpiresAfterTheApprovalTimeoutOrItsStartDate() {
        actingAs("FACILITY_MANAGER");
        Booking stale = booking(BookingStatus.PENDING_APPROVAL, unitD1);
        stale.setCreatedAt(LocalDateTime.now().minusHours(30));
        stale.setStartDate(LocalDate.now().plusDays(2));
        Booking pastStart = booking(BookingStatus.PENDING_APPROVAL, unitD1);
        pastStart.setId(UUID.randomUUID());
        pastStart.setCreatedAt(LocalDateTime.now().minusHours(2));
        pastStart.setStartDate(LocalDate.now().minusDays(1));
        when(bookingRepository.findById(stale.getId())).thenReturn(Optional.of(stale));
        when(bookingRepository.findById(pastStart.getId())).thenReturn(Optional.of(pastStart));
        when(bookingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AppException staleError = assertThrows(AppException.class,
                () -> bookingService.reviewBookingRequest(stale.getId(), true, null, null));
        AppException pastStartError = assertThrows(AppException.class,
                () -> bookingService.reviewBookingRequest(pastStart.getId(), false, null, "Hết kho"));

        assertThat(staleError.getErrorCode()).isEqualTo(ErrorCode.BOOKING_REQUEST_EXPIRED);
        assertThat(staleError.getMessage()).contains(stale.getBookingCode()).contains("hết hạn");
        assertThat(pastStartError.getErrorCode()).isEqualTo(ErrorCode.BOOKING_REQUEST_EXPIRED);
        assertThat(stale.getStatus()).isEqualTo(BookingStatus.CANCELLED);
        assertThat(pastStart.getStatus()).isEqualTo(BookingStatus.CANCELLED);
    }

    @Test
    void aConfirmedBookingCannotBeRejectedWithoutTheRefundPolicy() {
        actingAs("FACILITY_MANAGER");
        Booking booking = booking(BookingStatus.CONFIRMED, unitD1);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        AppException error = assertThrows(AppException.class,
                () -> bookingService.reviewBookingRequest(booking.getId(), false, null, null));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.BOOKING_REQUEST_NOT_PENDING_APPROVAL);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
    }

    // ------------------------------------------------------------------ access PIN

    @Test
    void pinStaysAvailableWhileTheMoveOutIsBeingProcessed() {
        Booking booking = booking(BookingStatus.CHECKOUT_REQUESTED, unitD1);
        booking.setAccessPin("cipher");
        booking.setHandoverTime(LocalDateTime.now().minusMonths(1));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(userRepository.findByEmail(customer.getEmail())).thenReturn(Optional.of(customer));
        when(encryptionService.decrypt("cipher")).thenReturn("482913");

        BookingPinResponse pin = bookingService.getBookingPin(booking.getId(), customer.getEmail());

        assertThat(pin.getPin()).isEqualTo("482913");
    }

    @Test
    void pinOfAReturnedUnitHasAClearMessage() {
        Booking booking = booking(BookingStatus.COMPLETED, unitD1);
        booking.setAccessPin("cipher");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(userRepository.findByEmail(customer.getEmail())).thenReturn(Optional.of(customer));

        AppException error = assertThrows(AppException.class, () -> bookingService.getBookingPin(booking.getId(), customer.getEmail()));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.BOOKING_ACCESS_ENDED);
    }

    // ------------------------------------------------------------------ DTO money

    @Test
    void initialPaymentDueSubtractsTheDepositAlreadyPaid() {
        actingAs("CUSTOMER");
        Booking booking = booking(BookingStatus.CONFIRMED, unitD1);
        booking.setPaymentStatus("PARTIALLY_PAID");
        when(requestContext.currentUserId()).thenReturn(customer.getId());
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        Payment deposit = Payment.builder().paymentType(PaymentType.DEPOSIT).status(PaymentStatus.PAID).amount(new BigDecimal("3200000")).build();
        when(paymentRepository.findAllByBooking_Id(booking.getId())).thenReturn(List.of(deposit));

        BookingResponse response = bookingService.getById(booking.getId());

        assertThat(response.getInitialPaymentAmount()).isEqualByComparingTo("6400000");
        assertThat(response.getInitialPaymentDue()).isEqualByComparingTo("3200000");
    }

    @Test
    void cancelledBookingWithACompletedRefundIsShownAsRefunded() {
        actingAs("CUSTOMER");
        Booking booking = booking(BookingStatus.CANCELLED, unitD1);
        booking.setPaymentStatus("PAID");
        when(requestContext.currentUserId()).thenReturn(customer.getId());
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        RefundRequest refund = RefundRequest.builder().status(RefundStatus.COMPLETED).build();
        when(refundRequestRepository.findByBookingId(booking.getId())).thenReturn(List.of(refund));

        assertThat(bookingService.getById(booking.getId()).getPaymentStatus()).isEqualTo("REFUNDED");
    }

    @Test
    void handedOverBookingNeverShowsAPartialPayment() {
        actingAs("CUSTOMER");
        Booking booking = booking(BookingStatus.ACTIVE, unitD1);
        booking.setPaymentStatus("PARTIALLY_PAID");
        booking.setHandoverTime(java.time.LocalDateTime.now().minusDays(30));
        when(requestContext.currentUserId()).thenReturn(customer.getId());
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        assertThat(bookingService.getById(booking.getId()).getPaymentStatus()).isEqualTo("PAID");
    }

    @Test
    void confirmedBookingBeforeHandoverKeepsItsPartialPayment() {
        actingAs("CUSTOMER");
        Booking booking = booking(BookingStatus.CONFIRMED, unitD1);
        booking.setPaymentStatus("PARTIALLY_PAID");
        when(requestContext.currentUserId()).thenReturn(customer.getId());
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        assertThat(bookingService.getById(booking.getId()).getPaymentStatus()).isEqualTo("PARTIALLY_PAID");
    }

    @Test
    void unpaidHoldThatMissedItsAppointmentIsCancelledNotOverdue() {
        Booking booking = booking(BookingStatus.CONFIRMED, unitD1);
        booking.setPaymentStatus("UNPAID");
        booking.setHoldExpiresAt(Instant.now().minusSeconds(3600));
        RentalContract contract = RentalContract.builder().status(RentalContractStatus.PENDING_SIGNATURE).build();
        when(bookingRepository.findExpiredHoldCandidates(any(), any(), any(), any())).thenReturn(List.of(booking));
        when(bookingRepository.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(paymentRepository.existsByBooking_IdAndStatus(booking.getId(), PaymentStatus.PAID)).thenReturn(false);
        when(rentalContractRepository.findByBookingId(booking.getId())).thenReturn(Optional.of(contract));
        when(storageUnitRepository.findWithDetailsByIdForUpdate(unitD1.getId())).thenReturn(Optional.of(unitD1));
        when(bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(eq(unitD1.getId()), any(), eq(booking.getId()))).thenReturn(false);

        bookingService.expireUnpaidBookings();

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
        assertThat(booking.getCancellationReason()).contains("Hết thời hạn giữ chỗ");
        assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.CANCELLED);
        assertThat(unitD1.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
    }
}
