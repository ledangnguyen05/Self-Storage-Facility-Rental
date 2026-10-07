package com.boxora.service.impl;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingResponse;
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
import com.boxora.service.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UserRepository userRepository;

    @Override
    public BookingResponse createBooking(BookingCreateRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(request.getStorageUnitId())
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        if (unit.getStatus() != UnitStatus.AVAILABLE) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }

        User customer = null;
        if (request.getCustomerId() != null) {
            customer = userRepository.findById(request.getCustomerId()).orElse(null);
        }
        if (customer == null) {
            customer = userRepository.findAll().stream().findFirst().orElse(null);
        }

        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();
        int months = request.getRentalMonths() != null ? request.getRentalMonths() : 1;
        LocalDate endDate = startDate.plusMonths(months);

        // BR-RULE-011: Lấy đơn giá có hiệu lực của kho lưu trữ (Grandfathering: giá mới áp dụng cho booking mới tạo)
        BigDecimal pricePerMonth = unit.getEffectiveBasePrice() != null
                ? unit.getEffectiveBasePrice()
                : new BigDecimal("1450000");

        BigDecimal totalFee = request.getTotalRentalFee() != null 
                ? request.getTotalRentalFee() 
                : pricePerMonth.multiply(BigDecimal.valueOf(months));

        BigDecimal deposit = request.getDepositPaid() != null 
                ? request.getDepositPaid() 
                : ((unit.getUnitType() != null && unit.getUnitType().getDepositAmount() != null)
                        ? unit.getUnitType().getDepositAmount()
                        : pricePerMonth);

        String pin = String.format("%06d", new Random().nextInt(1000000));
        String code = "BX-" + (2025 + new Random().nextInt(2)) + "-" + String.format("%04d", new Random().nextInt(10000));

        Booking booking = Booking.builder()
                .bookingCode(code)
                .customer(customer)
                .storageUnit(unit)
                .startDate(startDate)
                .endDate(endDate)
                .rentalMonths(months)
                .totalRentalFee(totalFee)
                .depositPaid(deposit)
                .status(BookingStatus.CONFIRMED)
                .accessPin(pin)
                .qrAccessToken("QR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .pinUpdatedAt(LocalDateTime.now())
                .build();

        unit.setStatus(UnitStatus.RESERVED);
        storageUnitRepository.save(unit);

        booking = bookingRepository.save(booking);
        return mapToResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getMyActiveBookings(UUID customerId) {
        List<Booking> bookings = bookingRepository.findAll();
        if (customerId != null) {
            bookings = bookings.stream()
                    .filter(b -> b.getCustomer() != null && customerId.equals(b.getCustomer().getId()))
                    .collect(Collectors.toList());
        }
        return bookings.stream().map(this::mapToResponse).collect(Collectors.toList());
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

    private BookingResponse mapToResponse(Booking b) {
        return BookingResponse.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .customerId(b.getCustomer() != null ? b.getCustomer().getId() : null)
                .customerName(b.getCustomer() != null ? b.getCustomer().getFullName() : "Nguyễn Văn An")
                .customerPhone(b.getCustomer() != null ? b.getCustomer().getPhone() : "0918 234 567")
                .customerEmail(b.getCustomer() != null ? b.getCustomer().getEmail() : "an.nguyen@gmail.com")
                .storageUnitId(b.getStorageUnit() != null ? b.getStorageUnit().getId() : null)
                .unitCode(b.getStorageUnit() != null ? b.getStorageUnit().getUnitCode() : "A-108")
                .facilityName(b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null 
                        ? b.getStorageUnit().getFacility().getName() 
                        : "Mega Central Tân Bình")
                .floorLevel(b.getStorageUnit() != null ? b.getStorageUnit().getFloorLevel() : "Tầng 1 - Khu A")
                .startDate(b.getStartDate())
                .endDate(b.getEndDate())
                .rentalMonths(b.getRentalMonths())
                .totalRentalFee(b.getTotalRentalFee())
                .depositPaid(b.getDepositPaid())
                .status(b.getStatus() != null ? b.getStatus() : BookingStatus.ACTIVE)
                .accessPin(b.getAccessPin() != null ? b.getAccessPin() : "882914")
                .qrAccessToken(b.getQrAccessToken() != null ? b.getQrAccessToken() : "QR-A108-SECURE")
                .handoverTime(b.getHandoverTime())
                .returnTime(b.getReturnTime())
                .build();
    }
}
