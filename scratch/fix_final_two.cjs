const fs = require('fs');

// 1. HandoverServiceImpl.java: Add completeCheckInStep1
{
  const file = 'BE/boxora/src/main/java/com/boxora/service/impl/HandoverServiceImpl.java';
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('completeCheckInStep1(')) {
    const step1Method = `
    @Override
    public void completeCheckInStep1(UUID bookingId) {
        HandoverPrerequisitesResponse prereq = getCheckInPrerequisites(bookingId);
        if (!prereq.isEligibleForInspection()) {
            throw new AppException(ErrorCode.CHECKIN_STEP_NOT_SATISFIED);
        }
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        User staff = requireAuthorizedStaffOperator(null);
        String stepLog = String.format("[%s] Hoàn tất đối soát 4 điều kiện bởi nhân viên %s. Chuyển sang bước Nghiệm thu hiện trường.\\n",
                LocalDateTime.now(), staff.getFullName());
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + stepLog);
        bookingRepository.save(booking);
    }
`;
    const lastBraceIdx = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIdx) + step1Method + '\n}';
    fs.writeFileSync(file, content, 'utf8');
    console.log('Added completeCheckInStep1 to HandoverServiceImpl');
  }
}

// 2. BookingServiceImpl.java: Replace getUpcomingArrivals() with full implementation
{
  const file = 'BE/boxora/src/main/java/com/boxora/service/impl/BookingServiceImpl.java';
  let content = fs.readFileSync(file, 'utf8');

  const oldMethod = `    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingArrivals() {
        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        List<Booking> list = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING_PAYMENT)
                .filter(b -> scopedFacilityId == null || (b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null && scopedFacilityId.equals(b.getStorageUnit().getFacility().getId())))
                .collect(Collectors.toList());

        return list.stream().map(this::mapToResponse).collect(Collectors.toList());
    }`;

  const newMethods = `    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingArrivals() {
        return getUpcomingArrivals(null, null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingArrivals(UUID facilityId) {
        return getUpcomingArrivals(facilityId, null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingArrivals(UUID facilityId, String timeframe, LocalDate fromDate, LocalDate toDate) {
        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID assignedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
            if (assignedFacilityId == null) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            if (facilityId != null && !facilityId.equals(assignedFacilityId)) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            effectiveFacilityId = assignedFacilityId;
        }

        final UUID targetFacilityId = effectiveFacilityId;
        List<Booking> source;
        try {
            source = targetFacilityId == null
                    ? bookingRepository.findAll()
                    : bookingRepository.findByStorageUnit_Facility_Id(targetFacilityId);
            if (source.isEmpty() && targetFacilityId != null) {
                source = bookingRepository.findAll().stream()
                        .filter(b -> b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                                && targetFacilityId.equals(b.getStorageUnit().getFacility().getId()))
                        .toList();
            }
        } catch (Exception e) {
            source = bookingRepository.findAll();
        }

        LocalDate today = LocalDate.now();

        return source.stream()
                .filter(b -> {
                    if (timeframe == null && fromDate == null && toDate == null) {
                        return (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING_PAYMENT
                                || b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.COMPLETED)
                                && b.getExpectedCheckInAt() != null;
                    }
                    if ("PAST".equalsIgnoreCase(timeframe) || "ALL".equalsIgnoreCase(timeframe)) {
                        return b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING_PAYMENT
                                || b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.COMPLETED
                                || b.getStatus() == BookingStatus.CANCELLED;
                    }
                    if ("TODAY".equalsIgnoreCase(timeframe) || "CURRENT".equalsIgnoreCase(timeframe)) {
                        return b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING_PAYMENT
                                || b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.COMPLETED;
                    }
                    return b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING_PAYMENT
                            || b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.COMPLETED;
                })
                .filter(b -> {
                    LocalDate checkInDate = b.getExpectedCheckInAt() != null
                            ? b.getExpectedCheckInAt().toLocalDate()
                            : b.getStartDate();
                    if (checkInDate == null) return false;

                    if ("TODAY".equalsIgnoreCase(timeframe) || "CURRENT".equalsIgnoreCase(timeframe)) {
                        if (!checkInDate.isEqual(today)) return false;
                    } else if ("PAST".equalsIgnoreCase(timeframe)) {
                        if (!checkInDate.isBefore(today)) return false;
                    } else if ("FUTURE".equalsIgnoreCase(timeframe)) {
                        if (!checkInDate.isAfter(today)) return false;
                    }

                    if (fromDate != null && checkInDate.isBefore(fromDate)) return false;
                    if (toDate != null && checkInDate.isAfter(toDate)) return false;

                    return true;
                })
                .sorted((a, b) -> {
                    LocalDateTime t1 = a.getExpectedCheckInAt() != null ? a.getExpectedCheckInAt() : a.getStartDate().atStartOfDay();
                    LocalDateTime t2 = b.getExpectedCheckInAt() != null ? b.getExpectedCheckInAt() : b.getStartDate().atStartOfDay();
                    if ("PAST".equalsIgnoreCase(timeframe)) {
                        return t2.compareTo(t1);
                    }
                    return t1.compareTo(t2);
                })
                .map(this::mapOperationalBookingResponse)
                .collect(Collectors.toList());
    }`;

  // Replace regardless of line endings
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedOld = oldMethod.replace(/\r\n/g, '\n');
  if (normalizedContent.includes(normalizedOld)) {
    content = normalizedContent.replace(normalizedOld, newMethods.replace(/\r\n/g, '\n'));
    fs.writeFileSync(file, content, 'utf8');
    console.log('Replaced getUpcomingArrivals in BookingServiceImpl');
  } else {
    console.log('Could not match oldMethod in BookingServiceImpl');
  }
}

