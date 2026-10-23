const fs = require('fs');
const file = 'BE/boxora/src/main/java/com/boxora/service/impl/HandoverServiceImpl.java';
let content = fs.readFileSync(file, 'utf8');

const methodsToAdd = `
    private String validateStoredDocumentUrl(String rawUrl, String fieldLabel) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, fieldLabel + " không được để trống");
        }
        String trimmed = rawUrl.trim();
        if (trimmed.regionMatches(true, 0, "data:", 0, 5)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    fieldLabel + " không chấp nhận chuỗi dữ liệu Base64 trực tiếp. Vui lòng tải tệp qua API upload tài liệu.");
        }
        if (trimmed.length() > 500) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    fieldLabel + " vượt quá giới hạn tối đa 500 ký tự (" + trimmed.length() + " ký tự)");
        }
        if (trimmed.contains("..")
                || !(trimmed.startsWith("/uploads/") || trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    fieldLabel + " phải là đường dẫn tệp hợp lệ (/uploads/... hoặc URL hợp lệ)");
        }
        return trimmed;
    }

    @Override
    public java.nio.file.Path getAuthorizedHandoverDocumentPath(UUID bookingId, String fileUrl) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        StorageUnit unit = booking.getStorageUnit();
        UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;

        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        if (currentUserId == null) {
            throw new AppException(ErrorCode.FORBIDDEN, "Yêu cầu xác thực để xem tài liệu");
        }
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Không tìm thấy người dùng xác thực"));
        String roleName = currentUser.getRole() != null ? currentUser.getRole().getName() : "";

        if ("CUSTOMER".equalsIgnoreCase(roleName)) {
            if (booking.getCustomer() == null || !currentUserId.equals(booking.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN, "Bạn không có quyền xem tài liệu của đơn đặt kho khác");
            }
        } else if ("STAFF".equalsIgnoreCase(roleName)
                || "FACILITY_MANAGER".equalsIgnoreCase(roleName)
                || "BUSINESS_MANAGER".equalsIgnoreCase(roleName)
                || "ADMIN".equalsIgnoreCase(roleName)) {
            if (facilityId != null) {
                facilityAccessGuard.checkFacilityAccess(facilityId);
            }
        } else {
            throw new AppException(ErrorCode.FORBIDDEN, "Vai trò người dùng không có quyền xem tài liệu này");
        }

        String cleanUrl = validateStoredDocumentUrl(fileUrl, "Đường dẫn tài liệu");
        if (!cleanUrl.startsWith("/uploads/")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Chỉ hỗ trợ truy xuất tệp nội bộ trong thư mục /uploads/");
        }

        boolean matchesBookingContract = rentalContractRepository.findByBookingId(booking.getId())
                .map(c -> cleanUrl.equals(c.getPaperContractUrl()))
                .orElse(false);
        boolean matchesBookingPayment = paymentRepository.findAllByBooking_Id(booking.getId()).stream()
                .anyMatch(p -> cleanUrl.equals(p.getProofDocumentUrl()));
        boolean matchesBookingFolder = cleanUrl.contains("/" + booking.getId() + "/");

        if (!matchesBookingContract && !matchesBookingPayment && !matchesBookingFolder) {
            throw new AppException(ErrorCode.FORBIDDEN, "Tài liệu không thuộc phạm vi đơn đặt kho này");
        }

        if (fileStorageService == null) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Dịch vụ lưu trữ tệp chưa sẵn sàng");
        }
        return fileStorageService.resolveStoredFilePath(cleanUrl);
    }
}
`;

const lastBraceIdx = content.lastIndexOf('}');
if (lastBraceIdx !== -1) {
  content = content.slice(0, lastBraceIdx) + methodsToAdd;
  fs.writeFileSync(file, content, 'utf8');
  console.log('Added methods to HandoverServiceImpl');
} else {
  console.log('Could not find closing brace');
}

