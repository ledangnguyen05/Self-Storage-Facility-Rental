package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverResponse;

import java.util.List;
import java.util.UUID;

public interface HandoverService {
    HandoverResponse checkIn(HandoverRequest request);
    HandoverResponse processReturn(HandoverRequest request);
    List<HandoverResponse> getByBookingId(UUID bookingId);
}
