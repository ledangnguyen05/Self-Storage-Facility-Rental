package com.boxora.dto.request;

import com.boxora.util.EmailAddresses;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {

    @NotBlank(message = "Vui lòng nhập email")
    @Email(message = "Email chưa đúng định dạng")
    private String email;

    @NotBlank(message = "Vui lòng nhập mật khẩu")
    private String password;

    /** A pasted address often carries spaces or a capital first letter; it identifies the same mailbox either way. */
    public void setEmail(String email) {
        this.email = EmailAddresses.normalize(email);
    }
}
