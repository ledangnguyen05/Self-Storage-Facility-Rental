package com.boxora.security;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class FacilityAccessGuard {

    // roles that see every facility's data, unscoped
    private static final Set<String> SYSTEM_WIDE_ROLES = Set.of("ADMIN", "BUSINESS_MANAGER", "BUSINESS_OPERATIONS_MANAGER", "SYSTEM_ADMIN");

    static final String NOT_ASSIGNED_MESSAGE =
            "Tài khoản của bạn chưa được phân công cơ sở nào. Vui lòng liên hệ quản trị viên để được phân công.";

    private final RequestContext requestContext;

    /**
     * Throws FACILITY_ACCESS_DENIED if the current user's role is facility-scoped
     * (STAFF / FACILITY_MANAGER) and their assigned facility does not match targetFacilityId.
     * ADMIN and BUSINESS_MANAGER always pass. CUSTOMER should never call this -
     * customer-owned-record checks belong in their own service, not here.
     */
    public void checkFacilityAccess(UUID targetFacilityId) {
        String role = requestContext.currentUserRole();
        if (role == null || SYSTEM_WIDE_ROLES.contains(role) || "CUSTOMER".equalsIgnoreCase(role)) {
            return;
        }

        UUID userFacilityId = requestContext.currentUserFacilityId();
        if (userFacilityId == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED, NOT_ASSIGNED_MESSAGE);
        }
        if (!userFacilityId.equals(targetFacilityId)) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
    }

    /** True if the current user should only see their own facility's rows in a list query. */
    public boolean isFacilityScoped() {
        String role = requestContext.currentUserRole();
        return role != null && !SYSTEM_WIDE_ROLES.contains(role) && !"CUSTOMER".equalsIgnoreCase(role);
    }

    /**
     * Facility to filter list queries by when isFacilityScoped() is true; null (= no filter) only for
     * system-wide roles, customers and anonymous callers.
     *
     * <p>Fails CLOSED: a STAFF / FACILITY_MANAGER account that has not been assigned to a facility gets
     * FACILITY_ACCESS_DENIED instead of null, so an unassigned account can never read the whole chain's data.
     */
    public UUID scopedFacilityIdOrNull() {
        if (!isFacilityScoped()) {
            return null;
        }
        UUID facilityId = requestContext.currentUserFacilityId();
        if (facilityId == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED, NOT_ASSIGNED_MESSAGE);
        }
        return facilityId;
    }
}