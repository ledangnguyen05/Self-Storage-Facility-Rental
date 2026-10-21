package com.boxora.service;

import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.request.FacilityUpdateRequest;
import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Mã cơ sở, mã kho, tên cơ sở và tên tầng được hiển thị lại cho người dùng nên không được chứa markup. */
class FacilityAndUnitCodeValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static StorageUnitCreateRequest unit(String code, String floor) {
        return StorageUnitCreateRequest.builder()
                .unitCode(code).floorLevel(floor).facilityId(UUID.randomUUID()).unitTypeId(UUID.randomUUID()).build();
    }

    private static FacilityCreateRequest facility(String name, String code) {
        return FacilityCreateRequest.builder().name(name).code(code).address("12 Điện Biên Phủ").build();
    }

    private static boolean hasViolationOn(Set<? extends ConstraintViolation<?>> violations, String property) {
        return violations.stream().anyMatch(v -> property.equals(v.getPropertyPath().toString()));
    }

    @Test
    @DisplayName("Seeded and typical unit codes are valid, surrounding spaces are tolerated (the service trims them)")
    void validUnitCodes() {
        for (String code : new String[]{"D1-A101", "d1-qa01", "TD-C204", "A_101", "A.101", " D1-QA01 ", "7"}) {
            assertThat(validator.validate(unit(code, "Tầng 1"))).as(code).isEmpty();
        }
    }

    @Test
    @DisplayName("Unit codes with markup, spaces inside or symbols are refused with a Vietnamese message")
    void invalidUnitCodes() {
        for (String code : new String[]{"<b>X</b>", "A 101", "A/101", "-A101", "A101;", "\"A\"", "<script>"}) {
            Set<ConstraintViolation<StorageUnitCreateRequest>> violations = validator.validate(unit(code, "Tầng 1"));
            assertThat(hasViolationOn(violations, "unitCode")).as(code).isTrue();
            assertThat(violations.iterator().next().getMessage()).contains("Mã kho");
        }
        StorageUnitUpdateRequest update = StorageUnitUpdateRequest.builder()
                .unitCode("<b>X</b>").floorLevel("Tầng 1").unitTypeId(UUID.randomUUID()).build();
        assertThat(hasViolationOn(validator.validate(update), "unitCode")).isTrue();
    }

    @Test
    @DisplayName("Floor names must not contain angle brackets")
    void floorNamesRefuseMarkup() {
        assertThat(validator.validate(unit("D1-A101", "Gác lửng"))).isEmpty();
        assertThat(hasViolationOn(validator.validate(unit("D1-A101", "<i>Tầng 1</i>")), "floorLevel")).isTrue();
    }

    @Test
    @DisplayName("Facility codes allow letters, digits, dash, underscore and dot only")
    void facilityCodes() {
        assertThat(validator.validate(facility("Boxora Quận 1", "HCM-D1"))).isEmpty();
        assertThat(validator.validate(facility("Boxora Quận 1", "qa-kt16211"))).isEmpty();
        assertThat(validator.validate(facility("Boxora Quận 1", " HCM-D1 "))).isEmpty();
        for (String code : new String[]{"<b>X</b>", "HCM D1", "HCM/D1", "<img src=x>"}) {
            assertThat(hasViolationOn(validator.validate(facility("Boxora Quận 1", code)), "code")).as(code).isTrue();
        }
        FacilityUpdateRequest update = new FacilityUpdateRequest();
        update.setCode("<b>X</b>");
        assertThat(hasViolationOn(validator.validate(update), "code")).isTrue();
        assertThat(validator.validate(new FacilityUpdateRequest())).isEmpty();
    }

    @Test
    @DisplayName("Facility names must not contain angle brackets, accents and apostrophes stay valid")
    void facilityNamesRefuseMarkup() {
        assertThat(validator.validate(facility("Boxora Bình Thạnh - Cơ sở số 2", "HCM-BT"))).isEmpty();
        assertThat(hasViolationOn(validator.validate(facility("QA <img src=x onerror=alert(1)>", "QA-1")), "name")).isTrue();
        FacilityUpdateRequest update = new FacilityUpdateRequest();
        update.setName("<b>Boxora</b>");
        assertThat(hasViolationOn(validator.validate(update), "name")).isTrue();
    }

    @Test
    @DisplayName("Unit type names must not contain angle brackets, Vietnamese names with punctuation stay valid")
    void unitTypeNamesRefuseMarkup() {
        UnitTypeCreateRequest ok = UnitTypeCreateRequest.builder().typeName("Kho lạnh (18-22°C)").dimensions("2m x 2m")
                .areaSqm(4.0).basePricePerMonth(BigDecimal.valueOf(900000)).depositAmount(BigDecimal.valueOf(900000)).build();
        assertThat(validator.validate(ok)).isEmpty();

        UnitTypeCreateRequest bad = UnitTypeCreateRequest.builder().typeName("<img src=x onerror=alert(1)>").dimensions("2m x 2m")
                .areaSqm(4.0).basePricePerMonth(BigDecimal.valueOf(900000)).depositAmount(BigDecimal.valueOf(900000)).build();
        assertThat(hasViolationOn(validator.validate(bad), "typeName")).isTrue();

        UnitTypeUpdateRequest update = UnitTypeUpdateRequest.builder().typeName("<b>Mini</b>").build();
        assertThat(hasViolationOn(validator.validate(update), "typeName")).isTrue();
        assertThat(validator.validate(UnitTypeUpdateRequest.builder().build())).isEmpty();
    }
}
