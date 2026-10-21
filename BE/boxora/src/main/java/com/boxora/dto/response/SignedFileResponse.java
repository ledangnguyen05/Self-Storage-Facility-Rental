package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** One entry of POST /api/v1/files/sign. {@code signedUrl} is null unless {@code status} is OK. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignedFileResponse {

    /** The path the caller asked for. */
    private String url;

    /** {@code /uploads/...?exp=..&sig=..}, valid until {@code expiresAt}. */
    private String signedUrl;

    private Instant expiresAt;

    /** OK, NOT_FOUND (no such file), FORBIDDEN (not allowed to see it) or INVALID (not an upload path). */
    private String status;
}
