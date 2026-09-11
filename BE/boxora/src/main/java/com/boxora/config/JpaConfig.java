package com.boxora.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@Configuration
@EnableJpaAuditing
// this class just use EnableJpaAuditing to enable @CreatedDate
// and @LastModifiedDate in BaseEntity class
public class JpaConfig {
}
