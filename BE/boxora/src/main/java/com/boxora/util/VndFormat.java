package com.boxora.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;

/**
 * Vietnamese money text for messages the backend composes: {@code 1.250.000 ₫} (dot as thousands separator, no decimals).
 * It never depends on the JVM's default locale, so the same amount reads the same on every server.
 */
public final class VndFormat {

    private static final char GROUPING = '.';

    private VndFormat() {
    }

    /** {@code 1.250.000 ₫}; null counts as zero. */
    public static String format(BigDecimal amount) {
        BigDecimal value = amount == null ? BigDecimal.ZERO : amount.setScale(0, RoundingMode.HALF_UP);
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(java.util.Locale.ROOT);
        symbols.setGroupingSeparator(GROUPING);
        symbols.setMinusSign('-');
        return new DecimalFormat("#,##0", symbols).format(value) + " ₫";
    }

    public static String format(long amount) {
        return format(BigDecimal.valueOf(amount));
    }
}
