package com.boxora.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import static com.boxora.util.EmailAddresses.PATTERN;

/**
 * An e-mail address a new account may be created with: valid syntax AND a top-level domain
 * (the web form rejects "a@b" too, so both sides agree). Null is valid; combine with {@code @NotBlank}.
 */
@Documented
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Email
@Pattern(regexp = PATTERN)
@ReportAsSingleViolation
public @interface ValidEmail {

    String message() default "Email chưa đúng định dạng";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
