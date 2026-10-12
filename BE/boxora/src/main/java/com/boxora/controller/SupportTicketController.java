package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.service.SupportTicketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/support-tickets")
@Tag(name = "Support Tickets", description = "API quản lý yêu cầu hỗ trợ sự cố, upload ảnh bằng chứng hiện trường và giải quyết ticket")
@RequiredArgsConstructor
public class SupportTicketController {

    private final SupportTicketService supportTicketService;

    @PostMapping
    @Operation(summary = "Tạo yêu cầu hỗ trợ sự cố mới (hỗ trợ đính kèm URL ảnh bằng chứng imageEvidence / evidenceUrls)")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> create(@Valid @RequestBody SupportTicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Yêu cầu hỗ trợ đã được ghi nhận", supportTicketService.createTicket(request)));
    }

    @PostMapping(value = "/upload-evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải lên 1 ảnh bằng chứng hiện trường sự cố (JPG, PNG, WEBP, tối đa 10MB)")
    public ResponseEntity<ApiResponse<FileUploadResponse>> uploadEvidence(@RequestParam("file") MultipartFile file) {
        FileUploadResponse response = supportTicketService.uploadEvidenceImage(file);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tải ảnh bằng chứng sự cố thành công", response));
    }

    @PostMapping(value = "/upload-evidences", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải lên nhiều ảnh bằng chứng hiện trường sự cố")
    public ResponseEntity<ApiResponse<List<FileUploadResponse>>> uploadEvidences(@RequestParam("files") List<MultipartFile> files) {
        List<FileUploadResponse> responses = supportTicketService.uploadEvidenceImages(files);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tải danh sách ảnh bằng chứng thành công", responses));
    }

    @PostMapping(value = "/with-evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
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
    @Operation(summary = "Lấy hàng đợi toàn bộ tickets xử lý sự cố cho nhân viên trực ca")
    public ResponseEntity<ApiResponse<List<SupportTicketResponse>>> getQueue() {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getQueue()));
    }

    @GetMapping("/my-tickets")
    @Operation(summary = "Lấy danh sách tickets sự cố của khách hàng")
    public ResponseEntity<ApiResponse<List<SupportTicketResponse>>> getMyTickets(@RequestParam(required = false) UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getMyTickets(customerId)));
    }

    @PatchMapping("/{id}/resolve")
    @Operation(summary = "Xác nhận đã xử lý hoàn tất sự cố kèm ghi chú khắc phục")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> resolve(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "Resolved by operations staff on-site") String resolutionNote
    ) {
        return ResponseEntity.ok(ApiResponse.success("Sự cố đã được xử lý hoàn tất", supportTicketService.resolveTicket(id, resolutionNote)));
    }
}
