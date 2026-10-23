const fs = require('fs');
const file = 'BE/boxora/src/main/java/com/boxora/service/impl/ContractSigningServiceImpl.java';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('paymentRepository;')) {
  content = content.replace(
    'private final BookingRepository bookingRepository;',
    'private final BookingRepository bookingRepository;\n    private final com.boxora.repository.PaymentRepository paymentRepository;\n    private final com.boxora.repository.RefundRequestRepository refundRequestRepository;'
  );
}

if (!content.includes('getContractByBookingId(UUID bookingId)')) {
  const method = `
    @Override
    @Transactional
    public RentalContractResponse getContractByBookingId(UUID bookingId) {
        if (bookingId == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }

        RentalContract contract = rentalContractRepository.findByBookingId(bookingId)
                .orElseGet(() -> {
                    Booking booking = bookingRepository.findById(bookingId)
                            .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
                    return ensureContractForBooking(booking);
                });

        if (contract == null) {
            throw new AppException(ErrorCode.CONTRACT_NOT_FOUND);
        }

        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || contract.getCustomer() == null || !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        return toResponseWithResolvedFields(contract);
    }
`;
  content = content.replace(
    'public class ContractSigningServiceImpl implements ContractSigningService {',
    'public class ContractSigningServiceImpl implements ContractSigningService {\n' + method
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('ContractSigningServiceImpl updated');

