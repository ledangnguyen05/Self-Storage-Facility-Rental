package com.boxora.config;

import com.boxora.repository.UserRepository;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // enables @PreAuthorize on controllers
public class SecurityConfig {

    @Bean
    public UserDetailsService userDetailsService(UserRepository userRepository) {
        return usernameOrEmail -> userRepository.findByEmail(usernameOrEmail)
                .or(() -> userRepository.findByUsername(usernameOrEmail))
                .map(user -> {
                    List<SimpleGrantedAuthority> authorities = new ArrayList<>();
                    if (user.getRole() != null && user.getRole().getName() != null) {
                        authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole().getName()));
                    }
                    return new org.springframework.security.core.userdetails.User(
                            user.getEmail() != null ? user.getEmail() : user.getUsername(),
                            user.getPassword(),
                            Boolean.TRUE.equals(user.getIsActive()),
                            true,
                            true,
                            true,
                            authorities
                    );
                })
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + usernameOrEmail));
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthFilter,
            AuthenticationProvider authenticationProvider
    ) throws Exception {
        http
                // Enable CORS
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // Disable CSRF — not needed for stateless JWT APIs
                .csrf(AbstractHttpConfigurer::disable)

                // Configure route permissions
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                )

                // Stateless session — no HTTP session stored server-side
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // Use our custom auth provider
                .authenticationProvider(authenticationProvider)

                // Add JWT filter before Spring's username/password filter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource() {
        org.springframework.web.cors.CorsConfiguration configuration = new org.springframework.web.cors.CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        org.springframework.web.cors.UrlBasedCorsConfigurationSource source = new org.springframework.web.cors.UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public AuthenticationProvider authenticationProvider(UserDetailsService userDetailsService) {
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