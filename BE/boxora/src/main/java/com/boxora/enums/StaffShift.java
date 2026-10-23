package com.boxora.enums;

import java.time.LocalTime;

public enum StaffShift {
    MORNING("Ca Sáng", LocalTime.of(6, 0), LocalTime.of(14, 0), false),
    AFTERNOON("Ca Chiều", LocalTime.of(14, 0), LocalTime.of(22, 0), false),
    NIGHT("Ca Đêm", LocalTime.of(22, 0), LocalTime.of(6, 0), true),
    FULL_DAY("Cả Ngày", LocalTime.of(8, 0), LocalTime.of(17, 0), false);

    private final String displayName;
    private final LocalTime defaultStartTime;
    private final LocalTime defaultEndTime;
    private final boolean overnight;

    StaffShift(String displayName, LocalTime defaultStartTime, LocalTime defaultEndTime, boolean overnight) {
        this.displayName = displayName;
        this.defaultStartTime = defaultStartTime;
        this.defaultEndTime = defaultEndTime;
        this.overnight = overnight;
    }

    public String getDisplayName() {
        return displayName;
    }

    public LocalTime getDefaultStartTime() {
        return defaultStartTime;
    }

    public LocalTime getDefaultEndTime() {
        return defaultEndTime;
    }

    public boolean isOvernight() {
        return overnight;
    }

    public static StaffShift fromTime(LocalTime time) {
        if (time == null) return MORNING;
        int hour = time.getHour();
        if (hour >= 6 && hour < 14) return MORNING;
        if (hour >= 14 && hour < 22) return AFTERNOON;
        return NIGHT;
    }
}


