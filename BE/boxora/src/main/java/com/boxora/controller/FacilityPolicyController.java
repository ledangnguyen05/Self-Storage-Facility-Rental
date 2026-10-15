package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityPolicyCreateRequest;
import com.boxora.dto.request.FacilityPolicyUpdateRequest;
import com.boxora.dto.request.FacilityPolicyExceptionGrantRequest;
import com.boxora.dto.response.FacilityPolicyResponse;
import com.boxora.service.FacilityPolicyService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("api/v1/facility-policies")
@Tag(
        name = "Facility policy ",
        description = "API quản lý chính sách của các cơ sở lưu trữ"
)
@RequiredArgsConstructor
@Slf4j
public class FacilityPolicyController {

    private final FacilityPolicyService facilityPolicyService;

    @GetMapping("{id}")
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER', 'ADMIN')")
    @Operation(summary = "Lấy chính sách cơ sở theo ID")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> getById(@PathVariable UUID id) {
        FacilityPolicyResponse response = facilityPolicyService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/by-facility/{facilityId}")
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER', 'ADMIN')")
    @Operation(summary = "Get facility policy by facility ID")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> getByFacilityId(
            @PathVariable UUID facilityId) {
        FacilityPolicyResponse response = facilityPolicyService.getByFacilityId(facilityId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Create a new facility policy")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> create(
            @Valid @RequestBody FacilityPolicyCreateRequest request) {

        FacilityPolicyResponse response = facilityPolicyService.create(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Created facility policy successfully", response));
    }

    @PutMapping("{id}")
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Update an existing facility policy")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody FacilityPolicyUpdateRequest request) {

        FacilityPolicyResponse response = facilityPolicyService.update(id, request);

        return ResponseEntity.ok(
                ApiResponse.success("Updated facility policy successfully.", response));
    }

    @GetMapping("{id}/exceptions")
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "List facility-manager policy exception grants")
    public ResponseEntity<ApiResponse<List<UUID>>> getExceptionGrants(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(facilityPolicyService.getExceptionGrants(id)));
    }

    @PutMapping("{id}/exceptions")
    @PreAuthorize("hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Grant or revoke a facility-manager policy exception")
    public ResponseEntity<ApiResponse<Void>> setExceptionGrant(
            @PathVariable UUID id,
            @Valid @RequestBody FacilityPolicyExceptionGrantRequest request) {
        facilityPolicyService.setExceptionGrant(id, request.getFacilityManagerId(), request.getGranted());
        return ResponseEntity.ok(ApiResponse.success("Updated policy exception grant successfully.", null));
    }

    @DeleteMapping("{id}")
    @PreAuthorize("hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Delete a facility policy")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        facilityPolicyService.delete(id);

        return ResponseEntity.ok(
                ApiResponse.success("Deleted facility policy successfully.", null));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER', 'ADMIN')")
    @Operation(summary = "Get all facility policies with pagination and search")
    public ResponseEntity<ApiResponse<PageResponse<FacilityPolicyResponse>>> getAll(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        PageResponse<FacilityPolicyResponse> response =
                facilityPolicyService.getAll(search, page, size, sortBy, sortDir);

        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
