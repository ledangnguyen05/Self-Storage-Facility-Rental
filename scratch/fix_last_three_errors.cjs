const fs = require('fs');

// 1. Fix ContractSigningServiceImpl.java
{
  const file = 'BE/boxora/src/main/java/com/boxora/service/impl/ContractSigningServiceImpl.java';
  let content = fs.readFileSync(file, 'utf8');

  // Change existing mockSign(UUID contractId) to mockSign(UUID contractId, String signatureData)
  // and add mockSign(UUID contractId) delegating to it
  if (!content.includes('mockSign(UUID contractId, String signatureData)')) {
    content = content.replace(
      'public RentalContractResponse mockSign(UUID contractId) {',
      `@Override\n    public RentalContractResponse mockSign(UUID contractId) {\n        return mockSign(contractId, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");\n    }\n\n    @Override\n    @Transactional\n    public RentalContractResponse mockSign(UUID contractId, String signatureData) {`
    );
    fs.writeFileSync(file, content, 'utf8');
    console.log('ContractSigningServiceImpl mockSign updated');
  }
}

// 2. Fix HandoverServiceImpl.java
{
  const file = 'BE/boxora/src/main/java/com/boxora/service/impl/HandoverServiceImpl.java';
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('uploadHandoverDocument(')) {
    const uploadMethod = `
    @Override
    public com.boxora.dto.response.FileUploadResponse uploadHandoverDocument(
            UUID bookingId,
            org.springframework.web.multipart.MultipartFile file,
            String documentType) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }
        requireAuthorizedStaffOperator(null);

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể tải tài liệu cho đơn đặt kho đã hủy hoặc đã hoàn tất");
        }

        String normalizedType = documentType != null ? documentType.trim().toUpperCase() : "PAPER_CONTRACT";
        String subDir;
        switch (normalizedType) {
            case "PAPER_CONTRACT" -> subDir = "contracts/" + booking.getId();
            case "PAYMENT_PROOF" -> subDir = "payments/" + booking.getId();
            case "CHECKIN_EVIDENCE" -> subDir = "handovers/" + booking.getId();
            default -> throw new AppException(ErrorCode.INVALID_REQUEST, "Loại tài liệu tải lên không hợp lệ: " + documentType);
        }

        if (fileStorageService == null) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Dịch vụ lưu trữ tệp chưa sẵn sàng");
        }
        return fileStorageService.storeDocumentFile(file, subDir);
    }

    private User requireAuthorizedStaffOperator(UUID requestedStaffId) {
        User staff = resolveStaff(requestedStaffId);
        if (staff == null) {
            throw new AppException(ErrorCode.FORBIDDEN, "Yêu cầu tài khoản nhân viên hoặc quản lý hợp lệ để thực hiện thao tác");
        }
        if (staff.getRole() != null && "CUSTOMER".equalsIgnoreCase(staff.getRole().getName())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Khách hàng không có quyền thực hiện nghiệp vụ nội bộ tại quầy");
        }
        return staff;
    }
`;
    const lastBraceIdx = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIdx) + uploadMethod + '\n}';
    fs.writeFileSync(file, content, 'utf8');
    console.log('HandoverServiceImpl uploadHandoverDocument updated');
  }
}

// 3. Fix BookingServiceImpl.java
{
  const file = 'BE/boxora/src/main/java/com/boxora/service/impl/BookingServiceImpl.java';
  let content = fs.readFileSync(file, 'utf8');

  // Add imports
  const neededImports = [
    'import com.boxora.dto.request.BookingRescheduleRequest;',
    'import com.boxora.dto.response.BookingRescheduleResponse;',
    'import com.boxora.entity.RentalContract;',
    'import com.boxora.enums.RentalContractStatus;',
    'import java.time.ZoneId;'
  ];
  for (const imp of neededImports) {
    if (!content.includes(imp)) {
      content = content.replace('package com.boxora.service.impl;', 'package com.boxora.service.impl;\n' + imp);
    }
  }

  // Add BUSINESS_ZONE constant
  if (!content.includes('BUSINESS_ZONE')) {
    content = content.replace(
      'public class BookingServiceImpl implements BookingService {',
      'public class BookingServiceImpl implements BookingService {\n\n    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");'
    );
  }

  // Add rescheduleBookingDetailed & rescheduleBooking
  if (!content.includes('rescheduleBookingDetailed(')) {
    const rescheduleMethods = `
    @Override
    @Transactional
    public BookingRescheduleResponse rescheduleBookingDetailed(UUID id, BookingRescheduleRequest request) {
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = requestContext != null && requestContext.currentUserId() != null
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        validateBookingAccess(booking, currentUser);

        if (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.BOOKING_ALREADY_ACTIVE);
        }
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new AppException(ErrorCode.BOOKING_ALREADY_CANCELLED);
        }
        if (booking.getHandoverTime() != null) {
            throw new AppException(ErrorCode.BOOKING_ALREADY_HANDED_OVER);
        }

        LocalDate newStartDate = request.getNewStartDate();
        if (newStartDate == null && request.getNewExpectedCheckInAt() != null) {
            newStartDate = request.getNewExpectedCheckInAt().toLocalDate();
        }
        if (newStartDate == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        if (newStartDate.isBefore(today)) {
            throw new AppException(ErrorCode.BOOKING_START_DATE_PAST);
        }

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;
        FacilityPolicy policy = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null)
                : null;

        int maxDays = (policy != null && policy.getMaxHoldDays() != null) ? policy.getMaxHoldDays() : maxAdvanceDays;
        if (newStartDate.isAfter(today.plusDays(maxDays))) {
            throw new AppException(ErrorCode.BOOKING_ADVANCE_NOTICE_EXCEEDED);
        }

        LocalDateTime newExpectedCheckIn = request.getNewExpectedCheckInAt();
        if (newExpectedCheckIn == null) {
            if (request.getNewCheckInTime() != null && !request.getNewCheckInTime().isBlank()) {
                try {
                    String[] parts = request.getNewCheckInTime().trim().split(":");
                    if (parts.length > 2) throw new IllegalArgumentException("Invalid time format");
                    int hour = Integer.parseInt(parts[0]);
                    int minute = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
                    newExpectedCheckIn = newStartDate.atTime(hour, minute);
                } catch (Exception e) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "A valid check-in appointment time is required");
                }
            } else {
                throw new AppException(ErrorCode.INVALID_REQUEST, "A check-in appointment time is required");
            }
        }

        LocalDateTime minAllowedCheckIn = LocalDateTime.now(BUSINESS_ZONE).plusHours(5);
        if (newExpectedCheckIn.isBefore(minAllowedCheckIn)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Giờ hẹn check-in mới phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho.");
        }

        if (unit != null) {
            boolean hasConflict = bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(
                    unit.getId(),
                    List.of(BookingStatus.ACTIVE),
                    booking.getId()
            );
            if (hasConflict) {
                throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
            }
        }

        int holdGraceHours = (policy != null && policy.getHoldGraceHours() != null) ? policy.getHoldGraceHours() : 24;
        Instant now = Instant.now();
        Instant appointmentInstant = newExpectedCheckIn.atZone(BUSINESS_ZONE).toInstant();
        Instant newHoldExpiresAt = appointmentInstant.plus(java.time.Duration.ofHours(holdGraceHours));
        if (newHoldExpiresAt.isBefore(now.plus(java.time.Duration.ofHours(24)))) {
            newHoldExpiresAt = now.plus(java.time.Duration.ofHours(24));
        }
        Instant maxHoldLimit = now.plus(java.time.Duration.ofDays(maxDays + 2));
        if (newHoldExpiresAt.isAfter(maxHoldLimit)) {
            newHoldExpiresAt = maxHoldLimit;
        }

        LocalDateTime prevAppt = booking.getExpectedCheckInAt();
        LocalDate prevStartDate = booking.getStartDate() != null ? booking.getStartDate() : newStartDate;
        LocalDate prevEndDate = booking.getEndDate() != null ? booking.getEndDate() : newStartDate.plusMonths(1);
        Instant prevHoldExpiresAt = booking.getHoldExpiresAt();

        int rentalMonths = (booking.getRentalMonths() != null && booking.getRentalMonths() > 0) ? booking.getRentalMonths() : 1;
        LocalDate newEndDate = newStartDate.plusMonths(rentalMonths);

        booking.setStartDate(newStartDate);
        booking.setEndDate(newEndDate);
        booking.setExpectedCheckInAt(newExpectedCheckIn);
        booking.setHoldExpiresAt(newHoldExpiresAt);
        booking.setPaymentExpiresAt(newHoldExpiresAt);
        booking = bookingRepository.save(booking);

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        String amendmentNotes = null;
        if (contractOpt.isPresent()) {
            RentalContract contract = contractOpt.get();
            contract.setStartDate(newStartDate);
            contract.setEndDate(newEndDate);
            rentalContractRepository.save(contract);
            if (contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION || contract.getStatus() == RentalContractStatus.ACTIVE) {
                amendmentNotes = String.format("Hợp đồng đã ký (%s) bảo lưu chữ ký số trọn vẹn. Ngày hiệu lực chính thức xác lập tại thời điểm bàn giao thực tế.",
                        contract.getContractCode());
            } else {
                amendmentNotes = String.format("Hợp đồng (%s) đã cập nhật lịch dự kiến nhận kho.", contract.getContractCode());
            }
        }

        String requesterRole = (currentUser != null && currentUser.getRole() != null)
                ? currentUser.getRole().getName()
                : (requestContext != null ? requestContext.currentUserRole() : "CUSTOMER");
        User requesterUser = currentUser != null ? currentUser : booking.getCustomer();

        BookingRescheduleHistory history = BookingRescheduleHistory.builder()
                .booking(booking)
                .changeType("CHECKIN_RESCHEDULE")
                .previousAppointmentAt(prevAppt)
                .requestedAppointmentAt(newExpectedCheckIn)
                .acceptedAppointmentAt(newExpectedCheckIn)
                .previousExpectedStartDate(prevStartDate)
                .previousExpectedEndDate(prevEndDate)
                .newExpectedStartDate(newStartDate)
                .newExpectedEndDate(newEndDate)
                .previousHoldExpiresAt(prevHoldExpiresAt)
                .newHoldExpiresAt(newHoldExpiresAt)
                .requester(requesterUser)
                .requesterRole(requesterRole != null ? requesterRole : "CUSTOMER")
                .requestTimestamp(LocalDateTime.now(BUSINESS_ZONE))
                .reason(request.getReason() != null && !request.getReason().isBlank() ? request.getReason() : "Khách hàng đổi lịch hẹn nhận kho")
                .processor(requesterUser)
                .processorRole(requesterRole != null ? requesterRole : "SYSTEM")
                .processedAt(LocalDateTime.now(BUSINESS_ZONE))
                .outcome("CONFIRMED")
                .previousBookingStatus(booking.getStatus().name())
                .resultingBookingStatus(booking.getStatus().name())
                .contractAmendmentRequired(false)
                .contractAmendmentNotes(amendmentNotes)
                .build();
        history = bookingRescheduleHistoryRepository.save(history);

        if (unit != null) {
            long effectiveLockHours = Math.max(1, java.time.Duration.between(now, newHoldExpiresAt).toHours() + 1);
            try {
                storageUnitLockService.tryLockUnit(unit.getId(), booking.getId(), effectiveLockHours);
            } catch (Exception ex) {
                log.warn("Could not update redis lock on reschedule: {}", ex.getMessage());
            }
        }

        UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
        String previousAppointmentText = prevAppt == null
                ? "not recorded"
                : prevAppt.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_RESCHEDULE,
                "Booking",
                booking.getId(),
                String.format("Đổi lịch hẹn nhận kho %s từ %s sang %s. Hạn giữ chỗ mới: %s. Lý do: %s",
                        booking.getBookingCode(),
                        previousAppointmentText,
                        newExpectedCheckIn.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")),
                        newHoldExpiresAt,
                        request.getReason() != null ? request.getReason() : "N/A"),
                null,
                booking.getStatus()
        );

        BookingResponse bookingResp = mapToResponse(booking);
        BookingRescheduleHistoryResponse historyResp = mapHistoryToResponse(history);
        String msg = String.format("Đổi lịch hẹn nhận kho thành công sang %s. Hạn giữ chỗ mới đã được cập nhật.",
                newExpectedCheckIn.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")));

        return BookingRescheduleResponse.builder()
                .booking(bookingResp)
                .historyRecord(historyResp)
                .message(msg)
                .build();
    }

    @Override
    public BookingResponse rescheduleBooking(UUID id, BookingRescheduleRequest request) {
        return rescheduleBookingDetailed(id, request).getBooking();
    }
`;
    const lastBraceIdx = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIdx) + rescheduleMethods + '\n}';
    fs.writeFileSync(file, content, 'utf8');
    console.log('BookingServiceImpl rescheduleBookingDetailed updated');
  }
}
