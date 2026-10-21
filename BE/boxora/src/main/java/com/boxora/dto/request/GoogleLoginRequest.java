package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoogleLoginRequest {

    @NotBlank(message = "Thiếu mã xác thực Google")
    private String idToken;

    /**
     * Mode: "LOGIN" (requires existing account, else throws GOOGLE_ACCOUNT_NOT_REGISTERED)
     *       "REGISTER" (creates account if new)
     */
    private String mode;
}
