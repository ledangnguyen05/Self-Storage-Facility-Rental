package com.boxora.service;

import com.boxora.dto.response.CaptchaResponse;

public interface CaptchaService {
    CaptchaResponse generateCaptcha();
    void validate(String captchaId, String inputCode);
}
