package com.boxora.dto;

import com.boxora.dto.request.ProfileUpdateRequest;
import com.boxora.dto.request.RegisterRequest;
import com.boxora.dto.request.UserCreateRequest;
import com.boxora.dto.request.UserUpdateRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/** Server-side rules must be at least as strict as the web form, otherwise an API client can bypass the form. */
class AuthRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void start() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void stop() {
        factory.close();
    }

    private static RegisterRequest register(String email, String fullName) {
        return RegisterRequest.builder().email(email).password("secret1").fullName(fullName)
                .phone("0912345670").captchaId("c").captchaCode("x").build();
    }

    private static String fields(Set<? extends ConstraintViolation<?>> violations) {
        return violations.stream().map(v -> v.getPropertyPath().toString()).sorted().collect(Collectors.joining(","));
    }

    @Test
    @DisplayName("Đăng ký: email không có tên miền cấp cao (qa+notld@example, a@b) bị từ chối như trên form")
    void emailWithoutTldIsRejected() {
        for (String bad : new String[]{"qa+notld@example", "a@b", "no-at-sign.vn", "two@@x.vn", "sp ace@x.vn", "x@y."}) {
            Set<ConstraintViolation<RegisterRequest>> v = validator.validate(register(bad, "Nguyen Van A"));
            assertEquals("email", fields(v), bad);
            assertEquals("Email chưa đúng định dạng", v.iterator().next().getMessage(), bad);
        }
    }

    @Test
    @DisplayName("Đăng ký: email hợp lệ (có +tag, chữ HOA, tên miền phụ) được chấp nhận")
    void validEmailsPass() {
        for (String ok : new String[]{"customer@gmail.com", "Customer@Gmail.com", "qa+tag-1@example.test", "a.b@mail.example.com.vn"}) {
            assertTrue(validator.validate(register(ok, "Nguyen Van A")).isEmpty(), ok);
        }
    }

    @Test
    @DisplayName("Họ tên chứa thẻ HTML/script bị từ chối ở đăng ký, tạo tài khoản, cập nhật tài khoản và hồ sơ cá nhân")
    void markupInNamesIsRejectedEverywhere() {
        String script = "<script>alert(1)</script>";

        assertEquals("fullName", fields(validator.validate(register("a@b.vn", script))));

        ProfileUpdateRequest profile = new ProfileUpdateRequest();
        profile.setFullName("<b>Bold</b>");
        profile.setPhone("0987654321");
        Set<ConstraintViolation<ProfileUpdateRequest>> profileViolations = validator.validate(profile);
        assertEquals("fullName", fields(profileViolations));
        assertEquals("Họ và tên không được chứa ký tự < hoặc >", profileViolations.iterator().next().getMessage());

        UserCreateRequest create = UserCreateRequest.builder().username("goodname").email("a@b.vn").password("secret1")
                .fullName("Evil <img src=x>").phone("0912345670").build();
        assertEquals("fullName", fields(validator.validate(create)));
        create.setFullName("Nguyen Van A");
        create.setUsername("<svg onload=1>");
        assertEquals("username", fields(validator.validate(create)));

        assertEquals("fullName", fields(validator.validate(UserUpdateRequest.builder().fullName("a<b>c").build())));
    }

    @Test
    @DisplayName("Đăng nhập / quên mật khẩu: email có khoảng trắng hoặc chữ HOA được chuẩn hóa thay vì bị từ chối")
    void loginAndForgotEmailAreNormalisedOnBinding() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

        com.boxora.dto.request.LoginRequest login = mapper.readValue(
                "{\"email\":\"  Customer@Gmail.COM \",\"password\":\"123456\"}", com.boxora.dto.request.LoginRequest.class);
        assertEquals("customer@gmail.com", login.getEmail());
        assertTrue(validator.validate(login).isEmpty());

        com.boxora.dto.request.ForgotPasswordRequest forgot = mapper.readValue(
                "{\"email\":\" Customer@Gmail.com\"}", com.boxora.dto.request.ForgotPasswordRequest.class);
        assertEquals("customer@gmail.com", forgot.getEmail());
        assertTrue(validator.validate(forgot).isEmpty());

        // Still validated after normalising.
        login.setEmail("not-an-email");
        assertEquals("email", fields(validator.validate(login)));
        login.setEmail("   ");
        assertEquals("email", fields(validator.validate(login)));
    }

    @Test
    @DisplayName("Họ tên có dấu tiếng Việt, dấu nháy, gạch nối, & vẫn hợp lệ")
    void ordinaryNamesRemainValid() {
        for (String name : new String[]{"Nguyễn Văn Á", "Trần Thị Bích Ngọc", "O'Brien", "Anh-Tuấn", "AT&T Corp", "Lê Văn 3"}) {
            ProfileUpdateRequest profile = new ProfileUpdateRequest();
            profile.setFullName(name);
            profile.setPhone("0987654321");
            assertTrue(validator.validate(profile).isEmpty(), name);
        }
    }

    @Test
    @DisplayName("Ký tự điều khiển (xuống dòng, NUL) trong họ tên bị từ chối")
    void controlCharactersAreRejected() {
        ProfileUpdateRequest profile = new ProfileUpdateRequest();
        profile.setPhone("0987654321");
        for (String name : new String[]{"Nguyen\nVan A", "Nguyen\u0000Van", "Tab\tName"}) {
            profile.setFullName(name);
            assertEquals("fullName", fields(validator.validate(profile)), name);
        }
    }
}
