package com.boxora.util;

import java.util.Locale;

/**
 * E-mail addresses identify an account, and a mailbox does not care about letter case: "Ngoc@Gmail.com" and
 * "ngoc@gmail.com" are the same person (a phone keyboard capitalises the first letter). Every code path that
 * stores, looks up or compares an address goes through {@link #normalize(String)} so the database only ever
 * holds the lower-case form (also enforced by the unique index on lower(email)).
 */
public final class EmailAddresses {

    /**
     * Same shape the web form accepts: something, one '@', something, a dot, something, no whitespace.
     * Hibernate's own {@code @Email} also accepts "user@host" without a top-level domain, which is never a
     * deliverable address on the public internet.
     */
    public static final String PATTERN = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

    private EmailAddresses() {
    }

    /** Trimmed, lower-case form of {@code email}; null stays null. */
    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
