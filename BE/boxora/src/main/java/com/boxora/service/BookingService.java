package com.boxora.service;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingResponse;

import java.util.List;
import java.util.UUID;

public interface BookingService {
    BookingResponse createBooking(BookingCreateRequest request);
    List<BookingResponse> getMyActiveBookings(UUID customerId);
    List<BookingResponse> getUpcomingArrivals();
    BookingResponse renewBooking(UUID id, int extraMonths);
    BookingResponse remoteUnlock(UUID id);
    BookingResponse getById(UUID id);
    com.boxora.dto.response.BookingPinResponse getBookingPin(UUID id, String currentUserEmail);
    com.boxora.dto.response.BookingPinResponse updateBookingPin(UUID id, com.boxora.dto.request.UpdatePinRequest request, String currentUserEmail);
}
