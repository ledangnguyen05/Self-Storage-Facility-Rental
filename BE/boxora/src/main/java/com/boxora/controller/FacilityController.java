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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("api/v1/facilities")
@Tag(name = "Facility", description = "API quản lý các cơ sở lưu trữ")
@RequiredArgsConstructor
@Slf4j
public class FacilityController {

    private final FacilityService facilityService;

    @GetMapping("{id}")
    @Operation(summary = "Lấy cơ sở theo ID")
    public ResponseEntity<ApiResponse<FacilityResponse>> getById(@PathVariable UUID id) {
        FacilityResponse response = facilityService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Create a new facility")
    public ResponseEntity<ApiResponse<FacilityResponse>> create(
            @Valid @RequestBody FacilityCreateRequest request) {
        FacilityResponse response = facilityService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Created facility successfully", response));
    }

    @PutMapping("{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Update an existing facility")
    public ResponseEntity<ApiResponse<FacilityResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody FacilityUpdateRequest request) {
        FacilityResponse response = facilityService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Updated facility successfully.", response));
    }

    @DeleteMapping("{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Delete a facility")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        facilityService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Deleted facility successfully.", null));
    }

    @GetMapping
    @Operation(summary = "Get all facilities with pagination and search")
    public ResponseEntity<ApiResponse<PageResponse<FacilityResponse>>> getAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) FacilityStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        PageResponse<FacilityResponse> response =
                facilityService.getAll(search, status, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}