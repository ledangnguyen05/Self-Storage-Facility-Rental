-- =========================================================================
-- V12: Seed Facility Policies
-- =========================================================================

INSERT INTO facility_policies (
    id, created_at, updated_at, facility_id, deposit_percentage, renewal_window_days,
    cancellation_full_refund_hours, cancellation_partial_refund_hours, cancellation_partial_refund_percent,
    return_notice_days, deposit_refund_sla_days, daily_late_fee, overdue_grace_days,
    overdue_access_disable_days, overdue_sealing_days, minimum_rental_months
)
VALUES (
    '55555555-4444-3333-2222-111111111111', NOW(), NOW(),
    'a1111111-2222-3333-4444-555555555555', 100.0, 3, 48, 24, 50.0, 0, 5, 50000.00, 1, 3, 7, 1
)
ON CONFLICT (facility_id) DO NOTHING;
