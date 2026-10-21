package com.boxora.util;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Chuẩn hóa tên tầng của kho về một dạng duy nhất để bộ lọc tầng không bị tách đôi vì dữ liệu lẫn lộn
 * ({@code Floor 1}, {@code Tang 1}, {@code tầng 1}, {@code F1}...). Nhãn chuẩn: {@code Tầng 1}, {@code Hầm 1}, {@code Tầng trệt}.
 * Tên không nhận diện được (ví dụ "Gác lửng") được giữ nguyên sau khi gọn khoảng trắng.
 */
public final class FloorLabels {

    private static final Pattern FLOOR = Pattern.compile("^(?:floor|tang|level|lau|f|l)\\s*\\.?\\s*0*(\\d+)$");
    private static final Pattern BARE_NUMBER = Pattern.compile("^0*(\\d+)$");
    private static final Pattern BASEMENT = Pattern.compile("^(?:basement|ham|b)\\s*\\.?\\s*0*(\\d+)$");
    private static final Pattern GROUND = Pattern.compile("^(?:ground(?:\\s+floor)?|tang\\s+tret|tret|g)$");
    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private FloorLabels() {
    }

    /** Nhãn chuẩn của tầng; {@code null} hoặc rỗng trả về {@code null}. */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String text = WHITESPACE.matcher(raw.trim()).replaceAll(" ");
        if (text.isEmpty()) {
            return null;
        }
        String folded = fold(text);

        Matcher basement = BASEMENT.matcher(folded);
        if (basement.matches()) {
            return "Hầm " + Integer.parseInt(basement.group(1));
        }
        Matcher floor = FLOOR.matcher(folded);
        if (floor.matches()) {
            return "Tầng " + Integer.parseInt(floor.group(1));
        }
        Matcher number = BARE_NUMBER.matcher(folded);
        if (number.matches()) {
            return "Tầng " + Integer.parseInt(number.group(1));
        }
        if (GROUND.matcher(folded).matches()) {
            return "Tầng trệt";
        }
        return text;
    }

    /** Khóa so sánh không phân biệt cách viết: hai nhãn cùng tầng cho cùng khóa. */
    public static String key(String raw) {
        String label = normalize(raw);
        return label == null ? "" : fold(label);
    }

    /** Hai tên tầng có cùng là một tầng không (bỏ qua cách viết). Cả hai rỗng thì không khớp. */
    public static boolean sameFloor(String a, String b) {
        String keyA = key(a);
        return !keyA.isEmpty() && keyA.equals(key(b));
    }

    private static String fold(String text) {
        String decomposed = Normalizer.normalize(text, Normalizer.Form.NFD);
        return COMBINING_MARKS.matcher(decomposed).replaceAll("")
                .replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .trim();
    }
}
