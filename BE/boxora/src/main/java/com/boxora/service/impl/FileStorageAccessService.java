package com.boxora.service.impl;

import com.boxora.dto.response.SignedFileResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.RefundRequest;
import com.boxora.entity.StoredFile;
import com.boxora.entity.SupportTicket;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.StoredFileRepository;
import com.boxora.repository.UploadReferenceRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Decides who may open an uploaded file and hands out the short-lived signed links.
 *
 * <p>A file is visible to: the user who uploaded it; system-wide roles (ADMIN, BUSINESS_MANAGER); the customer of the
 * booking / ticket / refund that references it; and staff or the facility manager of that record's facility. A file that
 * nothing references yet (a photo just taken in the check-in wizard) is visible to its uploader and to staff of the
 * facility it was uploaded for.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FileStorageAccessService {

    private static final Set<String> SYSTEM_WIDE_ROLES = Set.of("ADMIN", "BUSINESS_MANAGER", "BUSINESS_OPERATIONS_MANAGER", "SYSTEM_ADMIN");

    public static final String STATUS_OK = "OK";
    public static final String STATUS_NOT_FOUND = "NOT_FOUND";
    public static final String STATUS_FORBIDDEN = "FORBIDDEN";
    public static final String STATUS_INVALID = "INVALID";

    private final FileStorageService fileStorageService;
    private final StoredFileRepository storedFileRepository;
    private final UploadReferenceRepository uploadReferences;
    private final BookingRepository bookingRepository;
    private final RequestContext requestContext;
    private final UploadUrlSigner signer;

    /** Signs every path the signed-in user may see; the rest come back with a status explaining why not. */
    @Transactional(readOnly = true)
    public List<SignedFileResponse> sign(List<String> urls) {
        List<SignedFileResponse> results = new ArrayList<>();
        if (urls == null) {
            return results;
        }
        long expiresAt = signer.expiryFromNow();
        Set<String> seen = new LinkedHashSet<>();
        for (String raw : urls) {
            if (raw == null || !seen.add(raw)) {
                continue;
            }
            String path = UploadUrlSigner.normalizePath(raw);
            if (path == null) {
                results.add(SignedFileResponse.builder().url(raw).status(STATUS_INVALID).build());
            } else if (!fileStorageService.exists(path)) {
                results.add(SignedFileResponse.builder().url(raw).status(STATUS_NOT_FOUND).build());
            } else if (!canView(path)) {
                results.add(SignedFileResponse.builder().url(raw).status(STATUS_FORBIDDEN).build());
            } else {
                results.add(SignedFileResponse.builder()
                        .url(raw)
                        .signedUrl(signer.sign(path, expiresAt))
                        .expiresAt(Instant.ofEpochSecond(expiresAt))
                        .status(STATUS_OK)
                        .build());
            }
        }
        return results;
    }

    /** True when the signed-in user may see the file at this (plain, valid) /uploads path. */
    @Transactional(readOnly = true)
    public boolean canView(String path) {
        UUID userId = requestContext.currentUserId();
        if (userId == null || path == null) {
            return false;
        }
        String role = requestContext.currentUserRole();
        if (role != null && SYSTEM_WIDE_ROLES.contains(role.toUpperCase())) {
            return true;
        }
        boolean customer = "CUSTOMER".equalsIgnoreCase(role);
        UUID userFacilityId = customer ? null : requestContext.currentUserFacilityId();

        StoredFile stored = storedFileRepository.findByUrlPath(path).orElse(null);
        if (stored != null && userId.equals(stored.getUploadedById())) {
            return true;
        }

        Set<UUID> bookingIds = new LinkedHashSet<>(uploadReferences.findBookingIdsReferencingHandoverFile(path));
        if (stored != null && stored.getBookingId() != null) {
            bookingIds.add(stored.getBookingId());
        }
        for (UUID bookingId : bookingIds) {
            Booking booking = bookingRepository.findById(bookingId).orElse(null);
            if (booking == null) {
                continue;
            }
            UUID customerId = booking.getCustomer() != null ? booking.getCustomer().getId() : null;
            UUID facilityId = booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                    ? booking.getStorageUnit().getFacility().getId() : null;
            if (matches(customer, userId, userFacilityId, customerId, facilityId)) {
                return true;
            }
        }

        for (SupportTicket ticket : uploadReferences.findTicketsReferencing(path)) {
            UUID customerId = ticket.getCustomer() != null ? ticket.getCustomer().getId() : null;
            UUID facilityId = ticket.getFacility() != null ? ticket.getFacility().getId() : null;
            if (matches(customer, userId, userFacilityId, customerId, facilityId)) {
                return true;
            }
        }

        for (RefundRequest refund : uploadReferences.findRefundsReferencing(path)) {
            UUID customerId = refund.getCustomer() != null ? refund.getCustomer().getId() : null;
            UUID facilityId = refund.getFacility() != null ? refund.getFacility().getId() : null;
            if (matches(customer, userId, userFacilityId, customerId, facilityId)) {
                return true;
            }
        }

        // Not referenced yet: staff of the facility it was uploaded for (never customers).
        return !customer && stored != null && userFacilityId != null && userFacilityId.equals(stored.getFacilityId());
    }

    private static boolean matches(boolean customer, UUID userId, UUID userFacilityId, UUID recordCustomerId, UUID recordFacilityId) {
        if (customer) {
            return recordCustomerId != null && recordCustomerId.equals(userId);
        }
        return userFacilityId != null && userFacilityId.equals(recordFacilityId);
    }
}
