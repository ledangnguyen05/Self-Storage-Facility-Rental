package com.boxora.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.Pattern;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Free text that is shown back to people (names, notes) and therefore must never carry markup: angle brackets
 * and control characters are refused. Accents, apostrophes, hyphens and ampersands stay valid
 * ("Nguyễn Văn A", "O'Brien"). Null is valid; combine with {@code @NotBlank} where required.
 */
@Documented
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Pattern(regexp = "^[^<>\\p{Cntrl}]*$")
@ReportAsSingleViolation
public @interface PlainText {

    String message() default "Không được chứa ký tự < hoặc > hay ký tự điều khiển";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
