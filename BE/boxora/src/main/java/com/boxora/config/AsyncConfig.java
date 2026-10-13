package com.boxora.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@EnableAsync

/*this class will enable @Async annotation on EmailService
 ForgotPassword, Email verification, welcome email and notification email methods
 will not need to wait until email sends successfully to go to the next steps, methods or response*/
public class AsyncConfig {
}
