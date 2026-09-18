package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.response.FacilityResponse;
import com.boxora.service.FacilityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/facilities")
@RequiredArgsConstructor
public class FacilityController {

    private final FacilityService facilityService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<FacilityResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(facilityService.getAllFacilities()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FacilityResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(facilityService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<FacilityResponse>> create(@Valid @RequestBody FacilityCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Facility registered successfully", facilityService.createFacility(request)));
    }
}
