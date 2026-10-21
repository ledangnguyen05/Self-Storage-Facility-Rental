package com.boxora.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registers {@link AuthorizationFirstInterceptor} for the whole API. */
@Configuration
@RequiredArgsConstructor
public class AuthorizationFirstWebConfig implements WebMvcConfigurer {

    private final AuthorizationFirstInterceptor authorizationFirstInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authorizationFirstInterceptor).addPathPatterns("/api/**");
    }
}
