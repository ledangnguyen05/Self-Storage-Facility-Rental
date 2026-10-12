package com.boxora.service.impl;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingResponse;
import com.boxora.dto.response.BookingAccessCredentialsResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.scheduling.annotation.Scheduled;

@Service
@RequiredArgsConstructor
@Transactional
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UserRepository userRepository;
    private final RequestContext requestContext;

    @Override
    public BookingResponse createBooking(BookingCreateRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsByIdForUpdate(request.getStorageUnitId())
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        if (unit.getStatus() != UnitStatus.AVAILABLE) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }

        User customer = userRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        LocalDate startDate = request.getStartDate();
        int months = request.getRentalMonths();
        LocalDate endDate = startDate.plusMonths(months);

        BigDecimal pricePerMonth = (unit.getUnitType() != null && unit.getUnitType().getBasePricePerMonth() != null)
                ? unit.getUnitType().getBasePricePerMonth()
                : new BigDecimal("1450000");

        BigDecimal totalFee = pricePerMonth.multiply(BigDecimal.valueOf(months));
        BigDecimal deposit = unit.getUnitType() != null && unit.getUnitType().getDepositAmount() != null
                ? unit.getUnitType().getDepositAmount()
                : pricePerMonth;

        String code = "BX-" + (2025 + new Random().nextInt(2)) + "-" + String.format("%04d", new Random().nextInt(10000));

        Booking booking = Booking.builder()
                .bookingCode(code)
                .customer(customer)
                .storageUnit(unit)
                .startDate(startDate)
                .endDate(endDate)
                .rentalMonths(months)
                .totalRentalFee(totalFee)
                .depositPaid(BigDecimal.ZERO)
                .depositAmount(deposit)
                .paymentExpiresAt(Instant.now().plusSeconds(24 * 60 * 60))
                .status(BookingStatus.PENDING_PAYMENT)
                .build();

        unit.setStatus(UnitStatus.RESERVED);
        storageUnitRepository.save(unit);

        booking = bookingRepository.save(booking);
        return mapToResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getMyActiveBookings(UUID customerId) {
        UUID authenticatedCustomerId = requestContext.currentUserId();
        if (authenticatedCustomerId == null
                || (customerId != null && !authenticatedCustomerId.equals(customerId))) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        return bookingRepository.findByCustomer_Id(authenticatedCustomerId).stream()
                .filter(booking -> booking.getStatus() == BookingStatus.CONFIRMED
                        || booking.getStatus() == BookingStatus.ACTIVE)
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingArrivals() {
        List<Booking> list = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING_PAYMENT)
                .collect(Collectors.toList());
        return list.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    public BookingResponse renewBooking(UUID id, int extraMonths) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        LocalDate currentEnd = booking.getEndDate() != null ? booking.getEndDate() : LocalDate.now();
        booking.setEndDate(currentEnd.plusMonths(extraMonths));
        booking.setRentalMonths((booking.getRentalMonths() != null ? booking.getRentalMonths() : 0) + extraMonths);
        booking = bookingRepository.save(booking);

        return mapToResponse(booking);
    }

    @Override
    public BookingResponse remoteUnlock(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        UUID authenticatedCustomerId = requestContext.currentUserId();
        if (authenticatedCustomerId == null || booking.getCustomer() == null
                || !authenticatedCustomerId.equals(booking.getCustomer().getId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }
        // Trigger IoT signal simulation
        return mapToResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getById(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        return mapToResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingAccessCredentialsResponse getAccessCredentials(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        UUID authenticatedCustomerId = requestContext.currentUserId();
        if (authenticatedCustomerId == null || booking.getCustomer() == null
                || !authenticatedCustomerId.equals(booking.getCustomer().getId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }
        if (booking.getAccessPin() == null || booking.getQrAccessToken() == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }
        return BookingAccessCredentialsResponse.builder()
                .accessPin(booking.getAccessPin())
                .qrAccessToken(booking.getQrAccessToken())
                .build();
    }

    @Scheduled(fixedDelay = 60_000L)
    public void expireUnpaidBookings() {
        List<Booking> expiredBookings = bookingRepository.findByStatusAndPaymentExpiresAtBefore(
                BookingStatus.PENDING_PAYMENT, Instant.now());
        for (Booking booking : expiredBookings) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentExpiresAt(null);
            if (booking.getStorageUnit() != null && booking.getStorageUnit().getStatus() == UnitStatus.RESERVED) {
                booking.getStorageUnit().setStatus(UnitStatus.AVAILABLE);
                storageUnitRepository.save(booking.getStorageUnit());
            }
            bookingRepository.save(booking);
        }
    }

    private BookingResponse mapToResponse(Booking b) {
        boolean hasPaid = b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.ACTIVE;
        BigDecimal initialPaymentAmount = b.getTotalRentalFee() != null && b.getRentalMonths() != null && b.getRentalMonths() > 0
                ? b.getTotalRentalFee().divide(BigDecimal.valueOf(b.getRentalMonths())).add(
                        b.getDepositAmount() != null ? b.getDepositAmount() : BigDecimal.ZERO)
                : BigDecimal.ZERO;
        return BookingResponse.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .customerId(b.getCustomer() != null ? b.getCustomer().getId() : null)
                .customerName(b.getCustomer() != null ? b.getCustomer().getFullName() : null)
                .customerPhone(b.getCustomer() != null ? b.getCustomer().getPhone() : null)
                .customerEmail(b.getCustomer() != null ? b.getCustomer().getEmail() : null)
                .storageUnitId(b.getStorageUnit() != null ? b.getStorageUnit().getId() : null)
                .unitCode(b.getStorageUnit() != null ? b.getStorageUnit().getUnitCode() : null)
                .facilityName(b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null 
                        ? b.getStorageUnit().getFacility().getName() 
                        : null)
                .floorLevel(b.getStorageUnit() != null ? b.getStorageUnit().getFloorLevel() : null)
                .startDate(b.getStartDate())
                .endDate(b.getEndDate())
                .rentalMonths(b.getRentalMonths())
                .totalRentalFee(b.getTotalRentalFee())
                .depositPaid(b.getDepositPaid())
                .depositAmount(b.getDepositAmount())
                .initialPaymentAmount(initialPaymentAmount)
                .paymentExpiresAt(b.getPaymentExpiresAt())
                .status(b.getStatus() != null ? b.getStatus() : BookingStatus.ACTIVE)
                .accessPin(null)
                .qrAccessToken(null)
                .handoverTime(b.getHandoverTime())
                .returnTime(b.getReturnTime())
                .build();
    }
}
