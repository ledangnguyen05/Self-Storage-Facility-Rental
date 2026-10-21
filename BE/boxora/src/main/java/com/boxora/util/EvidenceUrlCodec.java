package com.boxora.util;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Stores a list of evidence file URLs in one TEXT column and validates the URLs the API accepts.
 *
 * <p>The list used to be joined with ';' which cannot work for {@code data:image/png;base64,...} values
 * (the separator is part of the data URL), so the stored value is now a JSON array. Rows written by the
 * old code are still readable: they are split on ';' and anything that is not a real URL is dropped.
 */
public final class EvidenceUrlCodec {

    /** Files the handover endpoints accept: only what POST /handovers/uploads stored on this server. */
    private static final Pattern UPLOADED_FILE = Pattern.compile("^/uploads/handover/[A-Za-z0-9._-]{1,120}$");
    private static final int MAX_URL_LENGTH = 300;
    private static final int MAX_URLS = 20;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() { };

    private EvidenceUrlCodec() {
    }

    /** JSON array text for storage, or null when there is nothing to store. */
    public static String encode(List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(new ArrayList<>(urls));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot encode evidence urls", e);
        }
    }

    /** URLs stored by {@link #encode} (or by the legacy ';' format). Never returns null. */
    public static List<String> decode(String stored) {
        if (stored == null || stored.isBlank()) {
            return List.of();
        }
        String text = stored.trim();
        if (text.startsWith("[")) {
            try {
                return clean(MAPPER.readValue(text, STRING_LIST));
            } catch (Exception ignored) {
                // fall through to the legacy parser
            }
        }
        List<String> parts = new ArrayList<>();
        for (String part : text.split("[;\\n]")) {
            parts.add(part);
        }
        return clean(parts);
    }

    private static List<String> clean(List<String> raw) {
        Set<String> urls = new LinkedHashSet<>();
        for (String item : raw) {
            if (item == null) {
                continue;
            }
            String value = item.trim();
            // Drops legacy base64 fragments ("data:image/jpeg", "base64,....") that were never real URLs.
            if (value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://")) {
                urls.add(value);
            }
        }
        return List.copyOf(urls);
    }

    /**
     * Validates URLs sent by a client: they must point to a file previously uploaded through
     * POST /handovers/uploads. Base64 data URLs and foreign links are rejected with a 400.
     */
    public static List<String> requireUploadedUrls(List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return List.of();
        }
        if (urls.size() > MAX_URLS) {
            throw new AppException(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID, "Chỉ đính kèm tối đa " + MAX_URLS + " tệp minh chứng cho mỗi biên bản");
        }
        Set<String> valid = new LinkedHashSet<>();
        for (String url : urls) {
            valid.add(requireUploadedUrl(url));
        }
        return List.copyOf(valid);
    }

    /** Single-URL variant; returns null for blank input. */
    public static String requireUploadedUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String value = url.trim();
        if (value.length() > MAX_URL_LENGTH || !UPLOADED_FILE.matcher(value).matches()) {
            throw new AppException(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
        }
        return value;
    }
}
