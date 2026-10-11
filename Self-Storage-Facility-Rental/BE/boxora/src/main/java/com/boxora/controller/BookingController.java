package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingResponse;
import com.boxora.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    public ResponseEntity<ApiResponse<BookingResponse>> create(@Valid @RequestBody BookingCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Booking created with access credentials", bookingService.createBooking(request)));
    }

    @GetMapping("/my-active")
    public ResponseEntity<ApiResponse<List<BookingResponse>>> getMyActive(@RequestParam(required = false) UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getMyActiveBookings(customerId)));
    }

    @GetMapping("/arrivals")
    public ResponseEntity<ApiResponse<List<BookingResponse>>> getArrivals() {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getUpcomingArrivals()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BookingResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getById(id)));
    }

    @PostMapping("/{id}/renew")
    public ResponseEntity<ApiResponse<BookingResponse>> renew(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "1") int extraMonths
    ) {
        return ResponseEntity.ok(ApiResponse.success("Contract renewed successfully", bookingService.renewBooking(id, extraMonths)));
    }

    @PostMapping("/{id}/remote-unlock")
    public ResponseEntity<ApiResponse<BookingResponse>> remoteUnlock(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Remote unlock signal dispatched to SmartLock IoT", bookingService.remoteUnlock(id)));
    }
}
