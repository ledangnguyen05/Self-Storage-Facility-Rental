package com.boxora.config;

import com.boxora.service.impl.JwtServiceImpl;
import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /**
     * Request attribute set when a Bearer token was sent but did not authenticate the call. The entry point turns it
     * into {@code WWW-Authenticate: Bearer error="invalid_token"}, the only signal on which the web app refreshes
     * its session and replays the request.
     */
    public static final String AUTH_FAILURE_ATTRIBUTE = "boxora.auth.failure";
    /** The access token is well-formed but past its expiry. */
    public static final String FAILURE_EXPIRED = "expired";
    /** Unreadable, wrongly signed, not an access token, or the account is gone / locked. */
    public static final String FAILURE_INVALID = "invalid";

    private final JwtServiceImpl jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // Skip filter for public endpoints
        final String requestPath = request.getServletPath();
        if (isPublicPath(requestPath)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Extract Authorization header
        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Extract and validate token
        final String jwt = authHeader.substring(7);
        try {
            final String userEmail = jwtService.extractEmail(jwt);

            // Only authenticate if not already authenticated
            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                if (jwtService.isAccessToken(jwt) && jwtService.isTokenValid(jwt)) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                } else {
                    request.setAttribute(AUTH_FAILURE_ATTRIBUTE, FAILURE_INVALID);
                }
            }
        } catch (ExpiredJwtException e) {
            log.debug("Access token expired: {}", e.getMessage());
            request.setAttribute(AUTH_FAILURE_ATTRIBUTE, FAILURE_EXPIRED);
            // Don't throw — let Spring Security handle the unauthenticated request
        } catch (Exception e) {
            log.warn("JWT validation failed: {}", e.getMessage());
            request.setAttribute(AUTH_FAILURE_ATTRIBUTE, FAILURE_INVALID);
            // Don't throw — let Spring Security handle the unauthenticated request
        }

        filterChain.doFilter(request, response);
    }

    /** Truly anonymous auth endpoints. /auth/profile and /auth/change-password must be authenticated, so they are parsed. */
    private static final java.util.Set<String> ANONYMOUS_AUTH_PATHS = java.util.Set.of(SecurityConfig.ANONYMOUS_AUTH_URLS);

    private boolean isPublicPath(String path) {
        return ANONYMOUS_AUTH_PATHS.contains(path) ||
                path.equals("/api/v1/payments/vnpay-return") ||
                path.equals("/api/v1/payments/vnpay-ipn") ||
                path.equals("/api/v1/payments/vnpay-verify") ||
                path.startsWith("/api/v1/contracts/webhook/") ||
                path.startsWith("/swagger-ui") ||
                path.startsWith("/api-docs") ||
                path.startsWith("/v3/api-docs");
    }
}