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
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Tạo yêu cầu hỗ trợ sự cố mới (khách hàng hoặc nhân viên trực ca)")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> create(@Valid @RequestBody SupportTicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Yêu cầu hỗ trợ đã được ghi nhận", supportTicketService.createTicket(request)));
    }

    @PostMapping(value = "/upload-evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Tải lên 1 ảnh bằng chứng hiện trường sự cố (JPG, PNG, WEBP, tối đa 10MB)")
    public ResponseEntity<ApiResponse<FileUploadResponse>> uploadEvidence(@RequestParam("file") MultipartFile file) {
        FileUploadResponse response = supportTicketService.uploadEvidenceImage(file);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tải ảnh bằng chứng sự cố thành công", response));
    }

    @PostMapping(value = "/upload-evidences", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Tải lên nhiều ảnh bằng chứng hiện trường sự cố")
    public ResponseEntity<ApiResponse<List<FileUploadResponse>>> uploadEvidences(@RequestParam("files") List<MultipartFile> files) {
        List<FileUploadResponse> responses = supportTicketService.uploadEvidenceImages(files);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tải danh sách ảnh bằng chứng thành công", responses));
    }

    @PostMapping(value = "/with-evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'FACILITY_MANAGER')")
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
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
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
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Xem chi tiết 1 phiếu sự cố theo ID")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getTicketById(id)));
    }

    @GetMapping("/my-tickets")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Khách hàng xem ticket của mình; nhân viên và quản lý cơ sở xem ticket trong phạm vi cơ sở của mình; BOM và Admin xem toàn hệ thống (lọc theo customerId nếu cần)")
    public ResponseEntity<ApiResponse<List<SupportTicketResponse>>> getMyTickets(@RequestParam(required = false) UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getMyTickets(customerId)));
    }

    @PostMapping("/{id}/take")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Nhân viên trực ca hoặc quản lý tiếp nhận xử lý ticket")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> takeOwnership(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Đã tiếp nhận xử lý phiếu sự cố", supportTicketService.takeOwnership(id)));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('FACILITY_MANAGER')")
    @Operation(summary = "Facility Manager phân công nhân viên xử lý ticket trong cơ sở")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> assign(
            @PathVariable UUID id,
            @Valid @RequestBody TicketAssignRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Phân công nhân viên xử lý thành công", supportTicketService.assignTicket(id, request)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Cập nhật tiến độ, ghi chú hoặc điều chỉnh trạng thái ticket")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> updateStatus(
            @PathVariable UUID id,
            @RequestBody TicketStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật tiến độ ticket thành công", supportTicketService.updateStatus(id, request)));
    }

    @PatchMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Xác nhận đã xử lý hoàn tất sự cố: phiếu phải đang xử lý, người gọi là người được phân công (hoặc quản lý cơ sở) và phải có ghi chú khắc phục")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> resolve(
            @PathVariable UUID id,
            @RequestParam(required = false) String resolutionNote
    ) {
        return ResponseEntity.ok(ApiResponse.success("Sự cố đã được xử lý hoàn tất", supportTicketService.resolveTicket(id, resolutionNote)));
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FACILITY_MANAGER')")
    @Operation(summary = "Khách hàng xác nhận hài lòng hoặc Facility Manager nghiệm thu đóng phiếu sự cố")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> close(
            @PathVariable UUID id,
            @RequestParam(required = false, defaultValue = "Khách hàng / Quản lý xác nhận đóng ticket") String note
    ) {
        return ResponseEntity.ok(ApiResponse.success("Phiếu sự cố đã được đóng thành công", supportTicketService.closeTicket(id, note)));
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FACILITY_MANAGER')")
    @Operation(summary = "Khách hàng hoặc Facility Manager yêu cầu xử lý lại khi sự cố chưa triệt để")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> reopen(
            @PathVariable UUID id,
            @Valid @RequestBody TicketReopenRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã mở lại phiếu sự cố để xử lý lại", supportTicketService.reopenTicket(id, request.getReason())));
    }

    @PostMapping("/{id}/contact-logs")
    @PreAuthorize("hasRole('FACILITY_MANAGER')")
    @Operation(summary = "Facility Manager ghi nhận nhật ký liên hệ hỗ trợ quản lý với BOM khi sự cố vượt thẩm quyền")
    public ResponseEntity<ApiResponse<SupportTicketContactLogResponse>> recordContactLog(
            @PathVariable UUID id,
            @Valid @RequestBody SupportTicketContactLogRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã ghi nhận nhật ký liên hệ hỗ trợ quản lý", supportTicketService.recordContactLog(id, request)));
    }

    @GetMapping("/{id}/contact-logs")
    @PreAuthorize("hasAnyRole('FACILITY_MANAGER', 'BUSINESS_MANAGER', 'STAFF', 'ADMIN')")
    @Operation(summary = "Xem lịch sử các lần liên hệ hỗ trợ quản lý của ticket")
    public ResponseEntity<ApiResponse<List<SupportTicketContactLogResponse>>> getContactLogs(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getContactLogs(id)));
    }

    @GetMapping("/escalation-contacts")
    @PreAuthorize("hasAnyRole('FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy danh bạ Business Operations Manager để Facility Manager liên hệ khi cần hỗ trợ cấp cao")
    public ResponseEntity<ApiResponse<List<EscalationContactResponse>>> getEscalationContacts() {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getEscalationContacts()));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Lấy thống kê tổng quan và chỉ số tuân thủ SLA sự cố")
    public ResponseEntity<ApiResponse<SupportTicketStatsResponse>> getStats(@RequestParam(required = false) UUID facilityId) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getStats(facilityId)));
    }
}
