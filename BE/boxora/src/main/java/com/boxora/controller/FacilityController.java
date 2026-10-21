package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.request.FacilityUpdateRequest;
import com.boxora.dto.response.FacilityResponse;
import com.boxora.enums.FacilityStatus;
import com.boxora.service.FacilityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("api/v1/facilities")
@Tag(name = "Facility", description = "API quản lý các cơ sở lưu trữ")
@Slf4j
public class FacilityController {

    private final FacilityService facilityService;

    public FacilityController(FacilityService facilityService) {
        this.facilityService = facilityService;
    }

    @GetMapping("{id}")
    @Operation(summary = "Lấy cơ sở theo ID (kèm số kho trống)")
    public ResponseEntity<ApiResponse<FacilityResponse>> getById(@PathVariable UUID id) {
        FacilityResponse response = facilityService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // SRS 3.3.2: Giám đốc vận hành và Quản trị viên hệ thống cùng quản lý dữ liệu cơ sở.
    @PostMapping
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Tạo cơ sở mới")
    public ResponseEntity<ApiResponse<FacilityResponse>> create(
            @Valid @RequestBody FacilityCreateRequest request) {
        FacilityResponse response = facilityService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã tạo cơ sở mới", response));
    }

    @PutMapping("{id}")
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Cập nhật cơ sở")
    public ResponseEntity<ApiResponse<FacilityResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody FacilityUpdateRequest request) {
        FacilityResponse response = facilityService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật cơ sở", response));
    }

    @DeleteMapping("{id}")
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Ngừng hoạt động cơ sở (không xóa cứng; bị từ chối khi còn kho đang thuê hoặc giữ chỗ)")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        facilityService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã chuyển cơ sở sang trạng thái Ngừng hoạt động", null));
    }

    @GetMapping
    @Operation(summary = "Danh sách cơ sở có phân trang, tìm kiếm và số kho trống. scope=public: toàn bộ cơ sở đang hoạt động cho trang công khai")
    public ResponseEntity<ApiResponse<PageResponse<FacilityResponse>>> getAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) FacilityStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String scope
    ) {
        PageResponse<FacilityResponse> response =
                facilityService.getAll(search, status, page, size, sortBy, sortDir, "public".equalsIgnoreCase(scope));
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
