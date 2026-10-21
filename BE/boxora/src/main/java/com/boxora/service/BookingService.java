package com.boxora.service;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingResponse;
import com.boxora.dto.response.BookingAccessCredentialsResponse;

import java.util.List;
import java.util.UUID;

public interface BookingService {
    BookingResponse createBooking(BookingCreateRequest request);
    List<BookingResponse> getMyBookingRequests();
    List<BookingResponse> getPendingApprovalRequests();
    BookingResponse reviewBookingRequest(UUID id, boolean approved);
    BookingResponse reviewBookingRequest(UUID id, boolean approved, UUID assignedStaffId, String notes);
    List<BookingResponse> getMyBookings(UUID customerId);
    List<BookingResponse> getMyActiveBookings(UUID customerId);
    List<BookingResponse> getUpcomingArrivals();
    /**
     * Role-scoped, paged booking list (GET /bookings): CUSTOMER sees own bookings; STAFF / FACILITY_MANAGER are
     * forced to their assigned facility; BUSINESS_MANAGER / ADMIN see every facility or {@code facilityId}.
     * {@code statusCsv} accepts one or more BookingStatus names separated by commas. PIN / QR are never included.
     */
    com.boxora.common.response.PageResponse<BookingResponse> searchBookings(
            UUID customerId, UUID facilityId, String statusCsv, String q, int page, int size);
    BookingResponse remoteUnlock(UUID id);
    BookingResponse getById(UUID id);
    com.boxora.dto.response.BookingPinResponse getBookingPin(UUID id, String currentUserEmail);
    com.boxora.dto.response.BookingPinResponse updateBookingPin(UUID id, com.boxora.dto.request.UpdatePinRequest request, String currentUserEmail);
    com.boxora.dto.response.BookingPinResponse getBookingPinByUnitId(UUID unitId, String currentUserEmail);
    com.boxora.dto.response.BookingPinResponse updateBookingPinByUnitId(UUID unitId, com.boxora.dto.request.UpdatePinRequest request, String currentUserEmail);
    BookingAccessCredentialsResponse getAccessCredentials(UUID id);
    BookingResponse rescheduleBooking(UUID id, com.boxora.dto.request.BookingRescheduleRequest request);
    com.boxora.dto.response.BookingRescheduleEligibilityResponse getRescheduleEligibility(UUID id);
    com.boxora.dto.response.BookingRescheduleResponse rescheduleBookingDetailed(UUID id, com.boxora.dto.request.BookingRescheduleRequest request);
    List<com.boxora.dto.response.BookingRescheduleHistoryResponse> getRescheduleHistory(UUID id);
}
