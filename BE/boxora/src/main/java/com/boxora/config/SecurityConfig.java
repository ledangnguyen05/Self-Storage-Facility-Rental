package com.boxora.config;

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

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private static final String[] PUBLIC_URLS = {
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh-token",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
            "/api/v1/auth/captcha",
            "/api/v1/auth/google",
            "/api/v1/auth/logout",
            "/api/v1/payments/vnpay-return",
            "/api/v1/payments/vnpay-ipn",
            "/api/v1/payments/vnpay-verify",
            "/api/v1/payments/vnpay/create",
            "/api/v1/payments/transaction/**",
            "/api/v1/payments/booking/*",
            "/api/v1/bookings/*",
            "/api/v1/bookings/*/cancel",
            "/api/v1/bookings/*/revoke-cancel",
            "/api/v1/bookings/*/confirm",
            "/api/v1/bookings/*/cancellation-preview",
            "/api/v1/bookings/code/*",
            "/api/v1/bookings/code/*/cancel",
            "/api/v1/bookings/code/*/revoke-cancel",
            "/api/v1/bookings/code/*/confirm",
            "/api/v1/contracts/webhook/**",
            "/api/v1/contracts/booking/**",
            "/api/v1/contracts/*/mock-sign",
            "/api/v1/contracts/*/signing-url",
            "/api/v1/contracts/*/send-for-signature",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/api-docs/**",
            "/v3/api-docs/**",
            "/uploads/**",
            "/api/v1/chatbot/**",
            "/api/v1/pricing/**",
            "/api/v1/geocoding/**",
            "/api/v1/cancellation-policy/**"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Disable CSRF — not needed for stateless JWT APIs
                .csrf(AbstractHttpConfigurer::disable)

                // Configure route permissions
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_URLS).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/facilities/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/storage-units/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/unit-types/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/facility-policies/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/bookings").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/bookings/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/bookings/code/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/payments/booking/*").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/payments/vnpay/create").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/contracts/booking/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/contracts/*/signing-url").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/contracts/*/send-for-signature").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/contracts/*/mock-sign").permitAll()
                        .anyRequest().authenticated()
                )

                // Return 401 Unauthorized instead of default 403 Forbidden on unauthenticated access
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new org.springframework.security.web.authentication.HttpStatusEntryPoint(org.springframework.http.HttpStatus.UNAUTHORIZED))
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
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public org.springframework.web.filter.CorsFilter corsFilter() {
        return new org.springframework.web.filter.CorsFilter(corsConfigurationSource());
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