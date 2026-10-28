package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.SupportTicketContactLogRequest;
import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.request.TicketAssignRequest;
import com.boxora.dto.request.TicketReopenRequest;
import com.boxora.dto.request.TicketStatusUpdateRequest;
import com.boxora.dto.response.EscalationContactResponse;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.SupportTicketContactLogResponse;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.dto.response.SupportTicketStatsResponse;
import com.boxora.service.SupportTicketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/support-tickets")
@Tag(name = "Support Tickets", description = "API quản lý yêu cầu hỗ trợ sự cố, upload ảnh bằng chứng, phân công nhân viên, giải quyết và nhật ký hỗ trợ quản lý")
@RequiredArgsConstructor
public class SupportTicketController {

    private final SupportTicketService supportTicketService;

    @PostMapping
    @PreAuthorize("hasAuthority('SUPPORT_CREATE')")
    @Operation(summary = "Tạo yêu cầu hỗ trợ sự cố mới (khách hàng hoặc nhân viên trực ca)")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> create(@Valid @RequestBody SupportTicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Yêu cầu hỗ trợ đã được ghi nhận", supportTicketService.createTicket(request)));
    }

    @PostMapping(value = "/upload-evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('SUPPORT_CREATE')")
    @Operation(summary = "Tải lên 1 ảnh bằng chứng hiện trường sự cố (JPG, PNG, WEBP, tối đa 10MB)")
    public ResponseEntity<ApiResponse<FileUploadResponse>> uploadEvidence(@RequestParam("file") MultipartFile file) {
        FileUploadResponse response = supportTicketService.uploadEvidenceImage(file);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tải ảnh bằng chứng sự cố thành công", response));
    }

    @PostMapping(value = "/upload-evidences", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('SUPPORT_CREATE')")
    @Operation(summary = "Tải lên nhiều ảnh bằng chứng hiện trường sự cố")
    public ResponseEntity<ApiResponse<List<FileUploadResponse>>> uploadEvidences(@RequestParam("files") List<MultipartFile> files) {
        List<FileUploadResponse> responses = supportTicketService.uploadEvidenceImages(files);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tải danh sách ảnh bằng chứng thành công", responses));
    }

    @PostMapping(value = "/with-evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('SUPPORT_CREATE')")
    @Operation(summary = "Tạo yêu cầu hỗ trợ đính kèm trực tiếp file ảnh bằng chứng hiện trường trong cùng 1 request")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> createWithEvidence(
            @Valid @RequestPart("ticket") SupportTicketRequest request,
            @RequestPart(value = "files", required = false) List<MultipartFile> files
    ) {
        SupportTicketResponse response = (files != null && !files.isEmpty())
                ? supportTicketService.createTicketWithFiles(request, files)
                : supportTicketService.createTicket(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Yêu cầu hỗ trợ kèm ảnh bằng chứng đã được ghi nhận", response));
    }

    @GetMapping("/queue")
    @PreAuthorize("hasAuthority('SUPPORT_VIEW')")
    @Operation(summary = "Lấy hàng đợi tickets sự cố (Staff/Manager theo cơ sở; BOM/Admin toàn hệ thống)")
    public ResponseEntity<ApiResponse<List<SupportTicketResponse>>> getQueue(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String priority
    ) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getQueue(facilityId, status, category, priority)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SUPPORT_VIEW')")
    @Operation(summary = "Xem chi tiết 1 phiếu sự cố theo ID")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getTicketById(id)));
    }

    @GetMapping("/my-tickets")
    @PreAuthorize("hasAuthority('SUPPORT_VIEW')")
    @Operation(summary = "Lấy danh sách tickets sự cố của khách hàng")
    public ResponseEntity<ApiResponse<List<SupportTicketResponse>>> getMyTickets(@RequestParam(required = false) UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getMyTickets(customerId)));
    }

    @PostMapping("/{id}/take")
    @PreAuthorize("hasAuthority('SUPPORT_UPDATE')")
    @Operation(summary = "Nhân viên trực ca hoặc quản lý tiếp nhận xử lý ticket")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> takeOwnership(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Đã tiếp nhận xử lý phiếu sự cố", supportTicketService.takeOwnership(id)));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAuthority('SUPPORT_ASSIGN')")
    @Operation(summary = "Facility Manager phân công nhân viên xử lý ticket trong cơ sở")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> assign(
            @PathVariable UUID id,
            @Valid @RequestBody TicketAssignRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Phân công nhân viên xử lý thành công", supportTicketService.assignTicket(id, request.getStaffId())));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('SUPPORT_UPDATE')")
    @Operation(summary = "Cập nhật tiến độ, ghi chú hoặc điều chỉnh trạng thái ticket")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> updateStatus(
            @PathVariable UUID id,
            @RequestBody TicketStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật tiến độ ticket thành công", supportTicketService.updateStatus(id, request)));
    }

    @PatchMapping("/{id}/resolve")
    @PreAuthorize("hasAuthority('SUPPORT_UPDATE')")
    @Operation(summary = "Xác nhận đã xử lý hoàn tất sự cố kèm ghi chú khắc phục")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> resolve(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "Đã kiểm tra hiện trường và xử lý xong tại chỗ bởi nhân viên") String resolutionNote
    ) {
        return ResponseEntity.ok(ApiResponse.success("Sự cố đã được xử lý hoàn tất", supportTicketService.resolveTicket(id, resolutionNote)));
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAuthority('SUPPORT_CLOSE')")
    @Operation(summary = "Khách hàng xác nhận hài lòng hoặc Facility Manager nghiệm thu đóng phiếu sự cố")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> close(
            @PathVariable UUID id,
            @RequestBody(required = false) com.boxora.dto.request.TicketCloseRequest request,
            @RequestParam(required = false) String note
    ) {
        String closingNote = request != null && request.getNote() != null ? request.getNote() : (note != null ? note : "Khách hàng / Quản lý xác nhận đóng ticket");
        Integer rating = request != null ? request.getRating() : null;
        String feedback = request != null && request.getFeedback() != null ? request.getFeedback() : closingNote;
        return ResponseEntity.ok(ApiResponse.success("Phiếu sự cố đã được đóng thành công",
                supportTicketService.closeTicketWithRating(id, closingNote, rating, feedback)));
    }

    @PostMapping("/{id}/regenerate-pin")
    @PreAuthorize("hasAnyAuthority('SUPPORT_UPDATE', 'SUPPORT_VIEW')")
    @Operation(summary = "Cấp lại mã PIN mới cho ô kho gặp sự cố khóa")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> regeneratePin(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Đã cấp lại mã PIN mới và đồng bộ xuống khóa IoT", supportTicketService.regeneratePin(id)));
    }

    @PostMapping("/{id}/remote-unlock")
    @PreAuthorize("hasAnyAuthority('SUPPORT_UPDATE', 'SUPPORT_VIEW')")
    @Operation(summary = "Mở khóa từ xa khẩn cấp hỗ trợ khách hàng")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> remoteUnlock(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Đã gửi lệnh mở khóa từ xa khẩn cấp", supportTicketService.remoteUnlock(id)));
    }

    @PostMapping("/{id}/adjust-billing")
    @PreAuthorize("hasAnyAuthority('SUPPORT_UPDATE', 'SUPPORT_VIEW')")
    @Operation(summary = "Điều chỉnh phụ phí / đối soát hóa đơn cho sự cố thanh toán")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> adjustBilling(
            @PathVariable UUID id,
            @RequestParam(required = false) java.math.BigDecimal amount,
            @RequestParam(required = false) String note
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã ghi nhận điều chỉnh thanh toán", supportTicketService.adjustBilling(id, amount, note)));
    }

    @PostMapping("/{id}/maintenance")
    @PreAuthorize("hasAnyAuthority('SUPPORT_UPDATE', 'SUPPORT_VIEW')")
    @Operation(summary = "Chuyển ô kho sang trạng thái bảo trì khi hư hỏng vật lý")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> setUnitMaintenance(
            @PathVariable UUID id,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false) String maintainerName
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã chuyển ô kho sang trạng thái bảo trì", supportTicketService.setUnitMaintenance(id, reason, maintainerName)));
    }

    @PostMapping("/{id}/transfer-unit")
    @PreAuthorize("hasAnyAuthority('SUPPORT_UPDATE', 'SUPPORT_VIEW')")
    @Operation(summary = "Điều chuyển khách hàng sang ô kho trống khác cùng kích thước")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> transferUnit(
            @PathVariable UUID id,
            @RequestParam UUID targetUnitId,
            @RequestParam(required = false) String reason
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã điều chuyển ô kho thành công cho khách hàng", supportTicketService.transferUnit(id, targetUnitId, reason)));
    }

    @PostMapping("/{id}/messages")
    @PreAuthorize("hasAnyAuthority('SUPPORT_UPDATE', 'SUPPORT_VIEW')")
    @Operation(summary = "Gửi ghi chú nội bộ hoặc phản hồi trực tiếp cho khách hàng")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.SupportTicketContactLogResponse>> addMessage(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "CUSTOMER_REPLY") String messageType,
            @RequestParam String content
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu tin nhắn thành công", supportTicketService.addTicketMessage(id, messageType, content)));
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasAuthority('SUPPORT_CLOSE')")
    @Operation(summary = "Khách hàng hoặc Facility Manager yêu cầu xử lý lại khi sự cố chưa triệt để")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> reopen(
            @PathVariable UUID id,
            @Valid @RequestBody TicketReopenRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã mở lại phiếu sự cố để xử lý lại", supportTicketService.reopenTicket(id, request.getReason())));
    }

    @PostMapping("/{id}/approve-refund")
    @PreAuthorize("hasAuthority('SUPPORT_UPDATE') or hasRole('FACILITY_MANAGER') or hasRole('ADMIN')")
    @Operation(summary = "Quản lý cơ sở hoặc Admin phê duyệt hoàn tiền cho yêu cầu trả kho")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> approveRefund(
            @PathVariable UUID id,
            @Valid @RequestBody com.boxora.dto.request.TicketApproveRefundRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã phê duyệt số tiền hoàn trả cho yêu cầu", supportTicketService.approveRefund(id, request)));
    }

    @PostMapping("/{id}/submit-bank-info")
    @PreAuthorize("hasRole('CUSTOMER') or hasAuthority('SUPPORT_VIEW')")
    @Operation(summary = "Khách hàng gửi thông tin tài khoản ngân hàng để nhận giải ngân tiền hoàn")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> submitBankInfo(
            @PathVariable UUID id,
            @Valid @RequestBody com.boxora.dto.request.TicketBankInfoRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã tiếp nhận thông tin ngân hàng của khách hàng", supportTicketService.submitBankInfo(id, request)));
    }

    @PostMapping("/{id}/admin-confirm-payout")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Admin xác nhận đã chuyển khoản thành công và đính kèm biên lai ảnh cloud")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> adminConfirmPayout(
            @PathVariable UUID id,
            @Valid @RequestBody com.boxora.dto.request.TicketAdminPayoutRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã ghi nhận chuyển khoản hoàn tất thành công", supportTicketService.adminConfirmPayout(id, request)));
    }

    @PostMapping("/{id}/contact-logs")
    @PreAuthorize("hasAuthority('SUPPORT_ESCALATE')")
    @Operation(summary = "Facility Manager ghi nhận nhật ký liên hệ hỗ trợ quản lý với BOM khi sự cố vượt thẩm quyền")
    public ResponseEntity<ApiResponse<SupportTicketContactLogResponse>> recordContactLog(
            @PathVariable UUID id,
            @Valid @RequestBody SupportTicketContactLogRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã ghi nhận nhật ký liên hệ hỗ trợ quản lý", supportTicketService.recordContactLog(id, request)));
    }

    @GetMapping("/{id}/contact-logs")
    @PreAuthorize("hasAuthority('SUPPORT_VIEW')")
    @Operation(summary = "Xem lịch sử các lần liên hệ hỗ trợ quản lý của ticket")
    public ResponseEntity<ApiResponse<List<SupportTicketContactLogResponse>>> getContactLogs(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getContactLogs(id)));
    }

    @GetMapping("/escalation-contacts")
    @PreAuthorize("hasAuthority('SUPPORT_VIEW')")
    @Operation(summary = "Lấy danh bạ Business Operations Manager để Facility Manager liên hệ khi cần hỗ trợ cấp cao")
    public ResponseEntity<ApiResponse<List<EscalationContactResponse>>> getEscalationContacts() {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getEscalationContacts()));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('SUPPORT_VIEW')")
    @Operation(summary = "Lấy thống kê tổng quan và chỉ số tuân thủ SLA sự cố")
    public ResponseEntity<ApiResponse<SupportTicketStatsResponse>> getStats(@RequestParam(required = false) UUID facilityId) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getStats(facilityId)));
    }
}
