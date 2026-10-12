package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.StaffAssignmentCreateRequest;
import com.boxora.dto.request.StaffAssignmentStatusUpdateRequest;
import com.boxora.dto.request.StaffAssignmentUpdateRequest;
import com.boxora.dto.response.StaffAssignmentResponse;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;
import com.boxora.service.StaffAssignmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/staff-assignments")
@Tag(name = "Staff Assignment", description = "API quản lý và phân công ca trực nhân viên theo cơ sở")
@RequiredArgsConstructor
@Slf4j
public class StaffAssignmentController {

    private final StaffAssignmentService staffAssignmentService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Tạo mới phân công ca trực cho nhân viên")
    public ResponseEntity<ApiResponse<StaffAssignmentResponse>> createAssignment(
            @Valid @RequestBody StaffAssignmentCreateRequest request
    ) {
        StaffAssignmentResponse response = staffAssignmentService.createAssignment(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Staff assignment created successfully", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Cập nhật phân công ca trực (ca, khu vực, vai trò, ghi chú)")
    public ResponseEntity<ApiResponse<StaffAssignmentResponse>> updateAssignment(
            @PathVariable UUID id,
            @Valid @RequestBody StaffAssignmentUpdateRequest request
    ) {
        StaffAssignmentResponse response = staffAssignmentService.updateAssignment(id, request);
        return ResponseEntity.ok(ApiResponse.success("Staff assignment updated successfully", response));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Cập nhật trạng thái ca trực (Điểm danh check-in, hoàn thành ca, báo vắng)")
    public ResponseEntity<ApiResponse<StaffAssignmentResponse>> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody StaffAssignmentStatusUpdateRequest request
    ) {
        StaffAssignmentResponse response = staffAssignmentService.updateStatus(id, request);
        return ResponseEntity.ok(ApiResponse.success("Staff assignment status updated successfully", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Xóa hoặc hủy phân công ca trực")
    public ResponseEntity<ApiResponse<Void>> deleteAssignment(@PathVariable UUID id) {
        staffAssignmentService.deleteAssignment(id);
        return ResponseEntity.ok(ApiResponse.success("Staff assignment deleted successfully", null));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Xem chi tiết một lượt phân công ca trực")
    public ResponseEntity<ApiResponse<StaffAssignmentResponse>> getById(@PathVariable UUID id) {
        StaffAssignmentResponse response = staffAssignmentService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Tra cứu danh sách phân công ca trực với bộ lọc và phân trang")
    public ResponseEntity<ApiResponse<PageResponse<StaffAssignmentResponse>>> getAllAssignments(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) UUID staffId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate assignedDate,
            @RequestParam(required = false) StaffShift shift,
            @RequestParam(required = false) StaffAssignmentStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "assignedDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        PageResponse<StaffAssignmentResponse> response = staffAssignmentService.getAllAssignments(
                facilityId, staffId, assignedDate, shift, status, fromDate, toDate, page, size, sortBy, sortDir
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/daily-board")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Bảng điều khiển ca trực trong ngày (Daily Task Board - SP2-06)")
    public ResponseEntity<ApiResponse<List<StaffAssignmentResponse>>> getDailyBoard(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        List<StaffAssignmentResponse> response = staffAssignmentService.getDailyBoard(facilityId, date);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
