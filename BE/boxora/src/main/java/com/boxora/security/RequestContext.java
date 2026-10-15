package com.boxora.security;

import com.boxora.entity.User;
import com.boxora.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class RequestContext {

    private final UserRepository userRepository;

    public UUID currentUserId() {
        return currentUser().map(User::getId).orElse(null);
    }

    /** Role name as stored on the user, e.g. "ADMIN", "FACILITY_MANAGER", "STAFF". */
    public String currentUserRole() {
        return currentUser()
                .map(u -> u.getRole() != null ? u.getRole().getName() : null)
                .orElse(null);
    }

    public String currentUserEmail() {
        return currentUser()
                .map(User::getEmail)
                .orElse(null);
    }

    /** Facility the current user is scoped to (STAFF/FACILITY_MANAGER only), or null. */
    public UUID currentUserFacilityId() {
        return currentUser()
                .map(u -> u.getFacility() != null ? u.getFacility().getId() : null)
                .orElse(null);
    }

    private Optional<User> currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return Optional.empty();
        }
        return userRepository.findByEmail(auth.getName());
    }

    public String currentIpAddress() {
        HttpServletRequest request = currentRequest();
        return request != null ? request.getRemoteAddr() : null;
    }

    public String currentUserAgent() {
        HttpServletRequest request = currentRequest();
        return request != null ? request.getHeader("User-Agent") : null;
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attrs != null ? attrs.getRequest() : null;
    }
}