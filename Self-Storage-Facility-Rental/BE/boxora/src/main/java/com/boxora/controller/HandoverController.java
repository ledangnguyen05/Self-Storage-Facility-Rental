package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.service.HandoverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/handovers")
@RequiredArgsConstructor
public class HandoverController {

    private final HandoverService handoverService;

    @PostMapping("/check-in")
    public ResponseEntity<ApiResponse<HandoverResponse>> checkIn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Check-in handover completed with smart lock activation", handoverService.checkIn(request)));
    }

    @PostMapping("/return")
    public ResponseEntity<ApiResponse<HandoverResponse>> processReturn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Return inspection and deposit release settled", handoverService.processReturn(request)));
    }

    @GetMapping("/booking/{bookingId}")
    public ResponseEntity<ApiResponse<List<HandoverResponse>>> getByBookingId(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(handoverService.getByBookingId(bookingId)));
    }
}
