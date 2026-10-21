package com.boxora.service.impl;

import com.boxora.enums.UnitStatus;

import java.math.BigDecimal;

/** Where a unit goes when its tenant returns it. */
public final class HandoverUnitRelease {

    private HandoverUnitRelease() {
    }

    /**
     * Only what was found at the inspection counts: a damage or cleaning charge, or a failed checklist item sends the unit
     * to maintenance. A late fee, a lost-card fee or the reason text of a deduction say nothing about the condition of the
     * unit, so a clean return that is merely overdue releases the unit straight back to AVAILABLE.
     */
    public static UnitStatus statusAfterReturn(BigDecimal damageFee, BigDecimal cleaningFee, boolean doorPassed,
                                               boolean cleanlinessPassed, boolean smartLockPassed, boolean sensorPassed,
                                               boolean wallPassed) {
        boolean hasDamageOrIssues = (damageFee != null && damageFee.signum() > 0)
                || (cleaningFee != null && cleaningFee.signum() > 0)
                || !doorPassed || !cleanlinessPassed || !smartLockPassed || !sensorPassed || !wallPassed;
        return hasDamageOrIssues ? UnitStatus.UNDER_MAINTENANCE : UnitStatus.AVAILABLE;
    }
}
