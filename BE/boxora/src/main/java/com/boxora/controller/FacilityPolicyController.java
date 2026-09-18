package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.FacilityPolicyRequest;
import com.boxora.dto.response.FacilityPolicyResponse;
import com.boxora.service.FacilityPolicyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/facility-policies")
@RequiredArgsConstructor
public class FacilityPolicyController {

    private final FacilityPolicyService facilityPolicyService;

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> getActive(@RequestParam(required = false) UUID facilityId) {
        return ResponseEntity.ok(ApiResponse.success(facilityPolicyService.getActivePolicy(facilityId)));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<FacilityPolicyResponse>> update(@RequestBody FacilityPolicyRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Dynamic pricing matrix updated and broadcasted network-wide", 
                facilityPolicyService.updatePolicy(request)));
    }
}
