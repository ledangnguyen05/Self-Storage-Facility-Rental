package com.boxora.config;

import com.boxora.security.ApiAuthenticationEntryPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.http.HttpMethod;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // enables @PreAuthorize on controllers
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;
    private final ApiAuthenticationEntryPoint authenticationEntryPoint;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /** Extra browser origins allowed to call the API (comma separated), e.g. a second dev server port. */
    @Value("${app.cors.extra-origins:}")
    private String extraOrigins;

    /**
     * Only the anonymous auth endpoints are public. /auth/profile and /auth/change-password are
     * deliberately NOT listed: they need a valid Bearer token (see {@link JwtAuthenticationFilter}).
     */
    static final String[] ANONYMOUS_AUTH_URLS = {
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/captcha",
            "/api/v1/auth/google",
            "/api/v1/auth/public-config",
            "/api/v1/auth/refresh-token",
            "/api/v1/auth/logout",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password"
    };

    private static final String[] PUBLIC_URLS = {
            "/api/v1/payments/vnpay-return",
            "/api/v1/payments/vnpay-ipn",
            "/api/v1/payments/vnpay-verify",
            "/api/v1/contracts/webhook/**",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/api-docs/**",
            "/v3/api-docs/**",
            // Reachable without a bearer token on purpose (an <img src> cannot send one), but FileStorageController
            // answers only for a short-lived HMAC-signed link issued by POST /api/v1/files/sign.
            "/uploads/**",
            "/api/v1/chatbot/**",
            "/api/v1/pricing/**"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Disable CSRF — not needed for stateless JWT APIs
                .csrf(AbstractHttpConfigurer::disable)

                // Configure route permissions
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(ANONYMOUS_AUTH_URLS).permitAll()
                        .requestMatchers(PUBLIC_URLS).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/facilities/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/storage-units/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/unit-types/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/facility-policies/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .anyRequest().authenticated()
                )

                // 401 (not 403) on unauthenticated access, with a JSON body and a WWW-Authenticate challenge that says
                // whether an access token was rejected (the web app may then refresh) or none was sent at all.
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                )

                // Stateless session — no HTTP session stored server-side
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // Use our custom auth provider
                .authenticationProvider(authenticationProvider())

                // Add JWT filter before Spring's username/password filter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        // Cross-origin deployments: let the web app read WHY a 401 happened (see ApiAuthenticationEntryPoint).
        configuration.setExposedHeaders(List.of("WWW-Authenticate"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /** Configured frontend origin plus local dev servers; blank entries and trailing slashes are dropped. */
    private List<String> allowedOrigins() {
        java.util.LinkedHashSet<String> origins = new java.util.LinkedHashSet<>();
        origins.add(frontendUrl);
        origins.add("http://localhost:5173");
        origins.add("http://localhost:3000");
        if (extraOrigins != null) {
            origins.addAll(java.util.Arrays.asList(extraOrigins.split(",")));
        }
        return origins.stream()
                .filter(o -> o != null && !o.isBlank())
                .map(String::trim)
                .map(o -> o.endsWith("/") ? o.substring(0, o.length() - 1) : o)
                .distinct()
                .toList();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}