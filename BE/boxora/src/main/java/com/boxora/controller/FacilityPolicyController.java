package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityPolicyCreateRequest;
import com.boxora.dto.request.FacilityPolicyUpdateRequest;
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

@RestController
@RequestMapping("/api/v1/facility-policies")
@Tag(
        name = "Facility policy ",
        description = "API quản lý chính sách của các cơ sở lưu trữ"
)
@Slf4j
public class FacilityPolicyController {

    private final FacilityPolicyService facilityPolicyService;

    public FacilityPolicyController(FacilityPolicyService facilityPolicyService) {
        this.facilityPolicyService = facilityPolicyService;
    }

    @GetMapping("{id}")
    @PreAuthorize("hasAuthority('POLICY_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER')")
    @Operation(summary = "Lấy chính sách cơ sở theo ID")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> getById(@PathVariable UUID id) {
        FacilityPolicyResponse response = facilityPolicyService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/by-facility/{facilityId}")
    @PreAuthorize("hasAuthority('POLICY_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER')")
    @Operation(summary = "Get facility policy by facility ID")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> getByFacilityId(
            @PathVariable UUID facilityId) {
        FacilityPolicyResponse response = facilityPolicyService.getByFacilityId(facilityId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('POLICY_CREATE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Create a new facility policy")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> create(
            @Valid @RequestBody FacilityPolicyCreateRequest request) {

        FacilityPolicyResponse response = facilityPolicyService.create(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Created facility policy successfully", response));
    }

    @PutMapping("{id}")
    @PreAuthorize("hasAuthority('POLICY_UPDATE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Update an existing facility policy")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody FacilityPolicyUpdateRequest request) {

        FacilityPolicyResponse response = facilityPolicyService.update(id, request);

        return ResponseEntity.ok(
                ApiResponse.success("Updated facility policy successfully.", response));
    }

    @DeleteMapping("{id}")
    @PreAuthorize("hasAuthority('POLICY_DELETE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Delete a facility policy")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        facilityPolicyService.delete(id);

        return ResponseEntity.ok(
                ApiResponse.success("Deleted facility policy successfully.", null));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('POLICY_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER')")
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
