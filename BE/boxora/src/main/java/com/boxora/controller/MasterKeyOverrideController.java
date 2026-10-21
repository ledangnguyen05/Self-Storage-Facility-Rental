package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.MasterKeyOverrideRequest;
import com.boxora.dto.response.MasterKeyOverrideResponse;
import com.boxora.service.MasterKeyOverrideService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/master-key")
@Tag(name = "Master Key", description = "API ghi nhận việc sử dụng chìa khóa cơ tổng khẩn cấp (BR-RULE-009)")
@PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
@RequiredArgsConstructor
@Slf4j
public class MasterKeyOverrideController {

    private final MasterKeyOverrideService masterKeyOverrideService;

    @PostMapping("/override")
    @Operation(summary = "Ghi nhận sử dụng Master Key - bắt buộc xác thực 2 người (performer + witness xác nhận mật khẩu)")
    public ResponseEntity<ApiResponse<MasterKeyOverrideResponse>> create(
            @Valid @RequestBody MasterKeyOverrideRequest request) {
        MasterKeyOverrideResponse response = masterKeyOverrideService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã ghi nhận lần sử dụng chìa khóa tổng", response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem chi tiết một lần sử dụng Master Key")
    public ResponseEntity<ApiResponse<MasterKeyOverrideResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(masterKeyOverrideService.getById(id)));
    }

    @GetMapping
    @Operation(summary = "Tra cứu lịch sử sử dụng Master Key (phân quyền theo facility)")
    public ResponseEntity<ApiResponse<PageResponse<MasterKeyOverrideResponse>>> getAll(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        PageResponse<MasterKeyOverrideResponse> response =
                masterKeyOverrideService.getAll(facilityId, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}