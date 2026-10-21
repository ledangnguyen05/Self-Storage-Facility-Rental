package com.boxora.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.Base64;
import java.util.regex.Pattern;

/**
 * Short-lived HMAC-signed links to the files under /uploads.
 *
 * <p>The link is {@code /uploads/<dir>/<file>?exp=<epoch seconds>&sig=<base64url HMAC-SHA256>}. The signature covers the
 * path and the expiry only, so it cannot be moved to another file or extended. The API signs a path only for a user who
 * may see the record that references it; the file endpoint then needs nothing but the signature, which is what lets a
 * plain {@code <img src>} or an "open in new tab" link work without an Authorization header.
 */
@Component
public class UploadUrlSigner {

    /** /uploads/&lt;sub directory&gt;/&lt;file name&gt;; the same shape FileStorageService writes. */
    public static final Pattern UPLOAD_PATH = Pattern.compile("^/uploads/([A-Za-z0-9_-]{1,40})/([A-Za-z0-9][A-Za-z0-9._-]{0,119})$");

    private static final String HMAC = "HmacSHA256";

    private final byte[] key;
    private final long ttlSeconds;
    private final Clock clock;

    @Autowired
    public UploadUrlSigner(
            @Value("${app.upload.signing-secret:${jwt.secret}}") String secret,
            @Value("${app.upload.url-ttl-seconds:900}") long ttlSeconds) {
        this(secret, ttlSeconds, Clock.systemUTC());
    }

    public UploadUrlSigner(String secret, long ttlSeconds, Clock clock) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("Thiếu khóa ký liên kết tệp tải lên (app.upload.signing-secret hoặc jwt.secret)");
        }
        // Derived key: the same property can be reused without the signature being usable as a JWT secret.
        this.key = hmac(secret.getBytes(StandardCharsets.UTF_8), "boxora-upload-url-v1".getBytes(StandardCharsets.UTF_8));
        this.ttlSeconds = Math.max(30, ttlSeconds);
        this.clock = clock;
    }

    public long ttlSeconds() {
        return ttlSeconds;
    }

    /** True when the value is a plain {@code /uploads/<dir>/<file>} path (no query, no traversal). */
    public static boolean isUploadPath(String path) {
        return path != null && UPLOAD_PATH.matcher(path).matches();
    }

    /** Strips a query string / fragment from a stored or submitted URL and returns the plain path, or null if it is not an upload path. */
    public static String normalizePath(String url) {
        if (url == null) {
            return null;
        }
        String value = url.trim();
        int cut = -1;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '?' || c == '#') {
                cut = i;
                break;
            }
        }
        if (cut >= 0) {
            value = value.substring(0, cut);
        }
        return isUploadPath(value) ? value : null;
    }

    public long expiryFromNow() {
        return clock.instant().getEpochSecond() + ttlSeconds;
    }

    public String signature(String path, long expiresAtEpochSeconds) {
        byte[] mac = hmac(key, (path + "\n" + expiresAtEpochSeconds).getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac);
    }

    /** {@code path?exp=..&sig=..}, valid until {@link #expiryFromNow()}. */
    public String sign(String path) {
        return sign(path, expiryFromNow());
    }

    public String sign(String path, long expiresAtEpochSeconds) {
        return path + "?exp=" + expiresAtEpochSeconds + "&sig=" + signature(path, expiresAtEpochSeconds);
    }

    /** Constant-time check of the signature, then the expiry. */
    public boolean verify(String path, Long expiresAtEpochSeconds, String signature) {
        if (!isUploadPath(path) || expiresAtEpochSeconds == null || signature == null || signature.isBlank()) {
            return false;
        }
        byte[] expected = signature(path, expiresAtEpochSeconds).getBytes(StandardCharsets.UTF_8);
        byte[] actual = signature.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, actual)) {
            return false;
        }
        return clock.instant().getEpochSecond() <= expiresAtEpochSeconds;
    }

    private static byte[] hmac(byte[] secret, byte[] data) {
        try {
            Mac mac = Mac.getInstance(HMAC);
            mac.init(new SecretKeySpec(secret, HMAC));
            return mac.doFinal(data);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 không khả dụng", e);
        }
    }
}
