package com.boxora.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

/** Public (anonymous) switches the login / register screens depend on. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PublicAuthConfigResponse {

    /** True when GOOGLE_CLIENT_ID is configured, i.e. the backend will accept Google ID tokens. */
    private boolean googleEnabled;

    /** OAuth client id the web app must use for Google sign-in (same value the backend verifies against). */
    private String googleClientId;

    /** True when SMTP is configured, so the forgot-password email can really be delivered. */
    private boolean passwordResetAvailable;
}
