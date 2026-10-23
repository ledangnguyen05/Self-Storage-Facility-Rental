const fs = require('fs');

// 1. Update HandoverServiceImpl.java
{
  const file = 'BE/boxora/src/main/java/com/boxora/service/impl/HandoverServiceImpl.java';
  let content = fs.readFileSync(file, 'utf8');

  // Add import if missing
  if (!content.includes('CheckInInspectionRequest')) {
    content = 'import com.boxora.dto.request.CheckInInspectionRequest;\n' + content;
  }

  if (!content.includes('recordCheckInInspection(')) {
    const inspectionMethod = `
    @Override
    public HandoverResponse recordCheckInInspection(com.boxora.dto.request.CheckInInspectionRequest request) {
        HandoverPrerequisitesResponse prereq = getCheckInPrerequisites(request.getBookingId());
        if (!prereq.isEligibleForInspection()) {
            throw new AppException(ErrorCode.CHECKIN_STEP_NOT_SATISFIED);
        }
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        StorageUnit unit = booking.getStorageUnit();
        User staff = requireAuthorizedStaffOperator(null);

        if (request.getDoorConditionPassed() == null
                || request.getCleanlinessPassed() == null
                || request.getSmartLockPassed() == null
                || request.getSensorPassed() == null
                || request.getWallStructurePassed() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "All five inspection checklist values are required.");
        }

        boolean doorPassed = Boolean.TRUE.equals(request.getDoorConditionPassed());
        boolean cleanlinessPassed = Boolean.TRUE.equals(request.getCleanlinessPassed());
        boolean smartLockPassed = Boolean.TRUE.equals(request.getSmartLockPassed());
        boolean sensorPassed = Boolean.TRUE.equals(request.getSensorPassed());
        boolean wallPassed = Boolean.TRUE.equals(request.getWallStructurePassed());

        String checklistSummary = String.format(
                "Cửa cuốn: %s | Vệ sinh: %s | SmartLock: %s | Cảm biến IoT: %s | Tường vách: %s",
                doorPassed ? "Đạt" : "Không đạt",
                cleanlinessPassed ? "Sạch sẽ" : "Chưa dọn",
                smartLockPassed ? "Tốt" : "Lỗi",
                sensorPassed ? "Chuẩn" : "Lỗi",
                wallPassed ? "Nguyên vẹn" : "Hư hại"
        );

        List<String> photos = request.getEvidencePhotos() != null
                ? request.getEvidencePhotos().stream()
                    .map(url -> validateStoredDocumentUrl(url, "Check-in evidence photo"))
                    .distinct()
                    .collect(Collectors.toList())
                : List.of();
        if (photos.size() < 2) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Two uploaded check-in evidence photos are required.");
        }
        String photosStr = String.join(";", photos);

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("CHECK_IN_INSPECTION")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : "Đạt chuẩn 5/5 kiểm định hiện trường")
                .checklistSummary(checklistSummary)
                .evidencePhotos(photosStr)
                .doorConditionPassed(doorPassed)
                .cleanlinessPassed(cleanlinessPassed)
                .smartLockPassed(smartLockPassed)
                .sensorPassed(sensorPassed)
                .wallStructurePassed(wallPassed)
                .notes(request.getNotes())
                .recordedAt(LocalDateTime.now())
                .build();
        record = handoverRecordRepository.save(record);

        UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_VERIFIED,
                "Booking",
                booking.getId(),
                String.format("Nhân viên %s đối soát đạt chuẩn 4 điều kiện check-in cho đơn %s",
                        staff.getFullName(), booking.getBookingCode()),
                null,
                null
        );

        return mapToResponse(record);
    }
`;
    const lastBraceIdx = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIdx) + inspectionMethod + '\n}';
    fs.writeFileSync(file, content, 'utf8');
    console.log('HandoverServiceImpl recordCheckInInspection added');
  }
}

// 2. Update BookingServiceImpl.java
{
  const file = 'BE/boxora/src/main/java/com/boxora/service/impl/BookingServiceImpl.java';
  let content = fs.readFileSync(file, 'utf8');

  // Add missing imports
  const neededImports = [
    'import com.boxora.dto.response.BookingRescheduleEligibilityResponse;',
    'import com.boxora.entity.Facility;',
    'import java.math.RoundingMode;',
    'import java.time.LocalTime;',
    'import java.util.ArrayList;',
    'import java.util.Optional;'
  ];
  for (const imp of neededImports) {
    if (!content.includes(imp)) {
      content = content.replace('package com.boxora.service.impl;', 'package com.boxora.service.impl;\n' + imp);
    }
  }

  // Add getRescheduleEligibility
  if (!content.includes('getRescheduleEligibility(')) {
    const eligibilityMethod = `
    @Override
    @Transactional(readOnly = true)
    public BookingRescheduleEligibilityResponse getRescheduleEligibility(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = requestContext != null && requestContext.currentUserId() != null
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        validateBookingAccess(booking, currentUser);

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;
        FacilityPolicy policy = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null)
                : null;

        boolean eligible = true;
        String reasonIfNotEligible = null;

        if (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.COMPLETED) {
            eligible = false;
            reasonIfNotEligible = "Kho đã được bàn giao thực tế và đang hoạt động. Không thể đổi lịch check-in.";
        } else if (booking.getStatus() == BookingStatus.CANCELLED) {
            eligible = false;
            reasonIfNotEligible = "Đơn đặt chỗ đã bị hủy. Không thể đổi lịch check-in.";
        } else if (booking.getHandoverTime() != null) {
            eligible = false;
            reasonIfNotEligible = "Kho đã được bàn giao thực tế, không thể đổi lịch nhận kho.";
        } else if (booking.getHoldExpiresAt() != null && booking.getHoldExpiresAt().isBefore(Instant.now())) {
            eligible = false;
            reasonIfNotEligible = "Thời hạn giữ chỗ của đơn đặt kho đã hết hạn.";
        } else if (booking.getPaymentExpiresAt() != null && booking.getPaymentExpiresAt().isBefore(Instant.now())
                && (booking.getDepositPaid() == null || booking.getDepositPaid().compareTo(BigDecimal.ZERO) <= 0)) {
            eligible = false;
            reasonIfNotEligible = "Đơn đặt kho đã quá hạn thanh toán giữ chỗ.";
        }

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        String contractStatus = contractOpt.map(c -> c.getStatus().name()).orElse("CHƯA_TẠO");
        boolean contractSigned = contractOpt.isPresent() && (
                contractOpt.get().getStatus() == RentalContractStatus.PENDING_ACTIVATION
                        || contractOpt.get().getStatus() == RentalContractStatus.ACTIVE
        );

        int maxDays = (policy != null && policy.getMaxHoldDays() != null) ? policy.getMaxHoldDays() : maxAdvanceDays;
        int holdGraceHours = (policy != null && policy.getHoldGraceHours() != null) ? policy.getHoldGraceHours() : 24;
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalDate allowedMinDate = today;
        LocalDate allowedMaxDate = today.plusDays(maxDays);

        LocalTime openTime = (facility != null && facility.getOpenTime() != null) ? facility.getOpenTime() : LocalTime.of(0, 0);
        LocalTime closeTime = (facility != null && facility.getCloseTime() != null) ? facility.getCloseTime() : LocalTime.of(23, 59);

        List<String> restrictions = new ArrayList<>();
        restrictions.add("Hệ thống kho Boxora hỗ trợ ra vào và check-in 24/7.");
        restrictions.add("Giờ hẹn check-in mới phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho.");
        restrictions.add(String.format("Thời hạn dời lịch tối đa %d ngày kể từ hôm nay (đến %s)", maxDays, allowedMaxDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))));
        restrictions.add(String.format("Thời gian giữ chỗ: Giữ kho thêm %d giờ sau thời điểm hẹn nhận kho", holdGraceHours));
        restrictions.add("Đổi lịch không phát sinh phụ phí, không làm thay đổi giá thuê, tiền cọc hay thời hạn thuê đã thỏa thuận.");
        if (contractSigned) {
            restrictions.add("Hợp đồng đã ký điện tử sẽ được bảo lưu trọn vẹn giá trị pháp lý và chữ ký. Ngày hiệu lực tính phí thuê sẽ kích hoạt tại thời điểm bàn giao thực tế tại cơ sở.");
        }

        LocalDateTime currentAppointmentAt = booking.getExpectedCheckInAt();

        BigDecimal monthlyFee = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return BookingRescheduleEligibilityResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .facilityName(facility != null ? facility.getName() : null)
                .eligible(eligible)
                .reasonIfNotEligible(reasonIfNotEligible)
                .restrictions(restrictions)
                .currentAppointmentAt(currentAppointmentAt)
                .expectedStartDate(booking.getStartDate())
                .expectedEndDate(booking.getEndDate())
                .rentalMonths(booking.getRentalMonths())
                .monthlyFee(monthlyFee)
                .depositAmount(booking.getDepositAmount())
                .paymentStatus(booking.getPaymentStatus())
                .contractStatus(contractStatus)
                .contractSigned(contractSigned)
                .holdExpiresAt(booking.getHoldExpiresAt() != null ? booking.getHoldExpiresAt() : booking.getPaymentExpiresAt())
                .allowedMinDate(allowedMinDate)
                .allowedMaxDate(allowedMaxDate)
                .facilityOpenTime(openTime.toString())
                .facilityCloseTime(closeTime.toString())
                .build();
    }
`;
    const lastBraceIdx = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIdx) + eligibilityMethod + '\n}';
    fs.writeFileSync(file, content, 'utf8');
    console.log('BookingServiceImpl getRescheduleEligibility added');
  }
}

