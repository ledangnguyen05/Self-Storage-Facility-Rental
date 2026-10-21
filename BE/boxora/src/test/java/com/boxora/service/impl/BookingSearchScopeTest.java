package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.BookingResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.StorageUnit;
import com.boxora.enums.BookingStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** GET /bookings is role-scoped (contract 1) and booking codes are collision-safe. */
@ExtendWith(MockitoExtension.class)
class BookingSearchScopeTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;
    @Mock
    private FacilityAccessGuard facilityAccessGuard;
    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private BookingServiceImpl bookingService;

    private final UUID currentUserId = UUID.randomUUID();
    private final UUID assignedFacilityId = UUID.randomUUID();

    private Booking booking() {
        Facility facility = Facility.builder().name("Boxora Quận 1").build();
        facility.setId(assignedFacilityId);
        StorageUnit unit = StorageUnit.builder().unitCode("A-101").facility(facility).build();
        unit.setId(UUID.randomUUID());
        Booking booking = Booking.builder()
                .bookingCode("BX-2026-ABC234")
                .storageUnit(unit)
                .status(BookingStatus.ACTIVE)
                .rentalMonths(3)
                .totalRentalFee(new BigDecimal("3000000"))
                .depositAmount(new BigDecimal("1000000"))
                .accessPin("ciphertext")
                .qrAccessToken("QR-1234ABCD")
                .build();
        booking.setId(UUID.randomUUID());
        return booking;
    }

    @SuppressWarnings("unchecked")
    private Specification<Booking> captureSpec() {
        ArgumentCaptor<Specification<Booking>> spec = ArgumentCaptor.forClass(Specification.class);
        verify(bookingRepository).findAll(spec.capture(), any(Pageable.class));
        return spec.getValue();
    }

    /** Evaluates the specification against mocks and returns the criteria builder to verify predicates. */
    @SuppressWarnings("unchecked")
    private CriteriaBuilder evaluate(Specification<Booking> spec) {
        Root<Booking> root = mock(Root.class, Answers.RETURNS_DEEP_STUBS);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        spec.toPredicate(root, query, cb);
        return cb;
    }

    @Test
    void customerAlwaysGetsOwnBookingsEvenWithAnotherCustomerId() {
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(currentUserId);
        when(bookingRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(booking()), PageRequest.of(0, 20), 1));

        PageResponse<BookingResponse> page = bookingService.searchBookings(UUID.randomUUID(), null, null, null, 0, 20);

        assertThat(page.getContent()).hasSize(1);
        BookingResponse response = page.getContent().get(0);
        assertThat(response.getFacilityId()).isEqualTo(assignedFacilityId);
        assertThat(response.getFacilityName()).isEqualTo("Boxora Quận 1");
        assertThat(response.getUnitId()).isEqualTo(response.getStorageUnitId());
        // The encrypted PIN and the QR token never leave the dedicated PIN endpoints.
        assertThat(response.getAccessPin()).isNull();
        assertThat(response.getQrAccessToken()).isNull();

        CriteriaBuilder cb = evaluate(captureSpec());
        verify(cb).equal(any(), eq(currentUserId));
    }

    @Test
    void staffIsForcedToAssignedFacilityWhateverFacilityIdIsSent() {
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        when(requestContext.currentUserId()).thenReturn(currentUserId);
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        when(facilityAccessGuard.scopedFacilityIdOrNull()).thenReturn(assignedFacilityId);
        when(bookingRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        UUID otherFacility = UUID.randomUUID();
        bookingService.searchBookings(null, otherFacility, "ACTIVE,CHECKOUT_REQUESTED", null, 0, 20);

        CriteriaBuilder cb = evaluate(captureSpec());
        verify(cb).equal(any(), eq(assignedFacilityId));
        verify(cb, never()).equal(any(), eq(otherFacility));
        verify(cb, never()).equal(any(), eq(currentUserId));
    }

    @Test
    void businessManagerCanFilterByFacilityAndPagesAreHonoured() {
        when(requestContext.currentUserRole()).thenReturn("BUSINESS_MANAGER");
        when(requestContext.currentUserId()).thenReturn(currentUserId);
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
        when(bookingRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(2, 50), 0));

        UUID facilityId = UUID.randomUUID();
        bookingService.searchBookings(null, facilityId, null, null, 2, 50);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(bookingRepository).findAll(any(Specification.class), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(2);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(50);
        CriteriaBuilder cb = evaluate(captureSpec());
        verify(cb).equal(any(), eq(facilityId));
    }

    @Test
    void unknownStatusIsA400NotA500() {
        when(requestContext.currentUserRole()).thenReturn("ADMIN");
        when(requestContext.currentUserId()).thenReturn(currentUserId);

        AppException error = assertThrows(AppException.class,
                () -> bookingService.searchBookings(null, null, "ACTIVE,NOT_A_STATUS", null, 0, 20));
        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.BOOKING_STATUS_FILTER_INVALID);
        verify(bookingRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void bookingCodeIsRetriedOnCollision() {
        when(bookingRepository.existsByBookingCode(any())).thenReturn(true, true, false);

        String code = bookingService.generateBookingCode();

        assertThat(code).matches("BX-\\d{4}-[A-HJ-NP-Z2-9]{6}");
        verify(bookingRepository, times(3)).existsByBookingCode(any());
    }

    @Test
    void bookingCodeGenerationGivesUpWithAClearError() {
        when(bookingRepository.existsByBookingCode(any())).thenReturn(true);

        AppException error = assertThrows(AppException.class, () -> bookingService.generateBookingCode());
        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.BOOKING_CODE_GENERATION_FAILED);
    }

    @Test
    void facilityPolicyIsLoadedOncePerFacilityForAPage() {
        when(requestContext.currentUserRole()).thenReturn("ADMIN");
        when(requestContext.currentUserId()).thenReturn(currentUserId);
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(assignedFacilityId)).thenReturn(Optional.empty());
        when(bookingRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(booking(), booking(), booking()), PageRequest.of(0, 20), 3));

        bookingService.searchBookings(null, null, null, null, 0, 20);

        verify(facilityPolicyRepository, times(1)).findByFacility_IdAndIsActiveTrue(assignedFacilityId);
    }
}
