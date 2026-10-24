package com.boxora.service;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingResponse;
import com.boxora.dto.response.BookingAccessCredentialsResponse;
import com.boxora.enums.BookingStatus;

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
    List<BookingResponse> getUpcomingArrivals(UUID facilityId);
    List<BookingResponse> getUpcomingArrivals(UUID facilityId, String timeframe, java.time.LocalDate fromDate, java.time.LocalDate toDate);
    BookingResponse claimCheckInReception(UUID bookingId);
    List<BookingResponse> getBookings(UUID customerId, BookingStatus status, UUID facilityId);
    BookingResponse renewBooking(UUID id, int extraMonths);
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
    BookingResponse assignUnitAndProvision(UUID bookingId, UUID unitId, String notes);
    BookingResponse assignUnitAndProvisionByCode(String bookingCode, UUID unitId, String notes);
    BookingResponse getByBookingCode(String bookingCode);
}
