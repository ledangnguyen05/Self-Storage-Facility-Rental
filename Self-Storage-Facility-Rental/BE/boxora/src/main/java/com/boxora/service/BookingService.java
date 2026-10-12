package com.boxora.service;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingResponse;
import com.boxora.dto.response.BookingAccessCredentialsResponse;

import java.util.List;
import java.util.UUID;

public interface BookingService {
    BookingResponse createBooking(BookingCreateRequest request);
    List<BookingResponse> getMyActiveBookings(UUID customerId);
    List<BookingResponse> getUpcomingArrivals();
    BookingResponse renewBooking(UUID id, int extraMonths);
    BookingResponse remoteUnlock(UUID id);
    BookingResponse getById(UUID id);
    BookingAccessCredentialsResponse getAccessCredentials(UUID id);
}
