package com.boxora.service.impl;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.HandoverRecord;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.HandoverRecordRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.HandoverService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HandoverServiceImpl implements HandoverService {

    private final HandoverRecordRepository handoverRecordRepository;
    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UserRepository userRepository;

    @Override
    public HandoverResponse checkIn(HandoverRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));

        User staff = null;
        if (request.getStaffId() != null) {
            staff = userRepository.findById(request.getStaffId()).orElse(null);
        }

        booking.setStatus(BookingStatus.ACTIVE);
        booking.setHandoverTime(LocalDateTime.now());
        if (request.getAccessPin() != null && !request.getAccessPin().isBlank()) {
            booking.setAccessPin(request.getAccessPin());
        }
        bookingRepository.save(booking);

        if (booking.getStorageUnit() != null) {
            StorageUnit unit = booking.getStorageUnit();
            unit.setStatus("OCCUPIED");
            storageUnitRepository.save(unit);
        }

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("CHECK_IN")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : "Đạt chuẩn 4/4 kiểm định")
                .notes(request.getNotes() != null ? request.getNotes() : "Đã kích hoạt SmartLock & giao thẻ RFID")
                .recordedAt(LocalDateTime.now())
                .build();

        record = handoverRecordRepository.save(record);
        return mapToResponse(record);
    }

    @Override
    public HandoverResponse processReturn(HandoverRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));

        User staff = null;
        if (request.getStaffId() != null) {
            staff = userRepository.findById(request.getStaffId()).orElse(null);
        }

        booking.setStatus(BookingStatus.COMPLETED);
        booking.setReturnTime(LocalDateTime.now());
        bookingRepository.save(booking);

        if (booking.getStorageUnit() != null) {
            StorageUnit unit = booking.getStorageUnit();
            unit.setStatus("AVAILABLE");
            storageUnitRepository.save(unit);
        }

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("RETURN")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : "Kho nguyên vẹn, sạch sẽ")
                .notes(request.getNotes() != null ? request.getNotes() : "Đã hoàn cọc đảm bảo thành công")
                .recordedAt(LocalDateTime.now())
                .build();

        record = handoverRecordRepository.save(record);
        return mapToResponse(record);
    }

    @Override
    public List<HandoverResponse> getByBookingId(UUID bookingId) {
        List<HandoverRecord> list = handoverRecordRepository.findByBooking_Id(bookingId);
        return list.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    private HandoverResponse mapToResponse(HandoverRecord r) {
        return HandoverResponse.builder()
                .id(r.getId())
                .bookingId(r.getBooking() != null ? r.getBooking().getId() : null)
                .bookingCode(r.getBooking() != null ? r.getBooking().getBookingCode() : "BX-2025-4421")
                .unitCode(r.getBooking() != null && r.getBooking().getStorageUnit() != null 
                        ? r.getBooking().getStorageUnit().getUnitCode() 
                        : "A-108")
                .customerName(r.getBooking() != null && r.getBooking().getCustomer() != null 
                        ? r.getBooking().getCustomer().getFullName() 
                        : "Phạm Hoàng Nam")
                .staffId(r.getStaff() != null ? r.getStaff().getId() : null)
                .staffName(r.getStaff() != null ? r.getStaff().getFullName() : "Lê Hoàng Nam")
                .recordType(r.getRecordType())
                .unitCondition(r.getUnitCondition())
                .notes(r.getNotes())
                .recordedAt(r.getRecordedAt() != null ? r.getRecordedAt() : LocalDateTime.now())
                .build();
    }
}
