const fs = require('fs');
const file = 'BE/boxora/src/main/java/com/boxora/service/impl/BookingServiceImpl.java';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports if missing
const importsToAdd = [
  'import com.boxora.dto.response.BookingRescheduleHistoryResponse;',
  'import com.boxora.entity.BookingRescheduleHistory;',
  'import com.boxora.entity.StaffAssignment;',
  'import com.boxora.enums.StaffAssignmentStatus;',
  'import com.boxora.repository.BookingRescheduleHistoryRepository;',
  'import com.boxora.repository.RentalContractRepository;',
  'import com.boxora.repository.StaffAssignmentRepository;',
  'import java.time.format.DateTimeFormatter;'
];

for (const imp of importsToAdd) {
  if (!content.includes(imp)) {
    content = imp + '\n' + content;
  }
}

// 2. Add fields if missing
if (!content.includes('bookingRescheduleHistoryRepository;')) {
  content = content.replace(
    'private final ApplicationEventPublisher eventPublisher;',
    'private final ApplicationEventPublisher eventPublisher;\n    private final BookingRescheduleHistoryRepository bookingRescheduleHistoryRepository;\n    private final RentalContractRepository rentalContractRepository;\n    private final StaffAssignmentRepository staffAssignmentRepository;'
  );
}

if (!content.includes('approvalTimeoutHours;')) {
  content = content.replace(
    'private long softLockHours;',
    'private long softLockHours;\n\n    @Value("${app.booking.approval-timeout-hours:24}")\n    private long approvalTimeoutHours;'
  );
}

// 3. Add getRescheduleHistory and mapHistoryToResponse if missing
if (!content.includes('getRescheduleHistory(UUID id)')) {
  const methods = `
    @Override
    @Transactional(readOnly = true)
    public List<BookingRescheduleHistoryResponse> getRescheduleHistory(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = requestContext != null && requestContext.currentUserId() != null
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        validateBookingAccess(booking, currentUser);

        List<BookingRescheduleHistory> list = bookingRescheduleHistoryRepository.findByBooking_IdOrderByCreatedAtDesc(id);
        return list.stream().map(this::mapHistoryToResponse).collect(Collectors.toList());
    }

    private BookingRescheduleHistoryResponse mapHistoryToResponse(BookingRescheduleHistory h) {
        return BookingRescheduleHistoryResponse.builder()
                .id(h.getId())
                .bookingId(h.getBooking().getId())
                .bookingCode(h.getBooking().getBookingCode())
                .changeType(h.getChangeType())
                .previousAppointmentAt(h.getPreviousAppointmentAt())
                .requestedAppointmentAt(h.getRequestedAppointmentAt())
                .acceptedAppointmentAt(h.getAcceptedAppointmentAt())
                .previousExpectedStartDate(h.getPreviousExpectedStartDate())
                .previousExpectedEndDate(h.getPreviousExpectedEndDate())
                .newExpectedStartDate(h.getNewExpectedStartDate())
                .newExpectedEndDate(h.getNewExpectedEndDate())
                .previousHoldExpiresAt(h.getPreviousHoldExpiresAt())
                .newHoldExpiresAt(h.getNewHoldExpiresAt())
                .requesterId(h.getRequester() != null ? h.getRequester().getId() : null)
                .requesterName(h.getRequester() != null
                        ? (h.getRequester().getFullName() != null ? h.getRequester().getFullName() : h.getRequester().getUsername())
                        : "Khách hàng")
                .requesterRole(h.getRequesterRole())
                .requestTimestamp(h.getRequestTimestamp())
                .reason(h.getReason())
                .processorId(h.getProcessor() != null ? h.getProcessor().getId() : null)
                .processorName(h.getProcessor() != null
                        ? (h.getProcessor().getFullName() != null ? h.getProcessor().getFullName() : h.getProcessor().getUsername())
                        : "Hệ thống Boxora")
                .processorRole(h.getProcessorRole())
                .processedAt(h.getProcessedAt())
                .outcome(h.getOutcome())
                .rejectionReason(h.getRejectionReason())
                .previousBookingStatus(h.getPreviousBookingStatus())
                .resultingBookingStatus(h.getResultingBookingStatus())
                .contractAmendmentRequired(h.getContractAmendmentRequired())
                .contractAmendmentNotes(h.getContractAmendmentNotes())
                .createdAt(h.getCreatedAt() != null ? h.getCreatedAt() : h.getProcessedAt())
                .build();
    }
`;
  const lastBraceIdx = content.lastIndexOf('}');
  content = content.slice(0, lastBraceIdx) + methods + '\n}';
}

fs.writeFileSync(file, content, 'utf8');
console.log('BookingServiceImpl updated successfully');

