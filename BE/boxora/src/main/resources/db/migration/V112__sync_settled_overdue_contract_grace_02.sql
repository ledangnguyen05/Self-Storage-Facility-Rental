-- ==============================================================================
-- Migration V112: Sync payment penalty deduction and refund request for settled
-- demo contract CTR-D7-GRACE-02 to accurately reflect in revenue and cashflow reports
-- ==============================================================================

-- 1. Insert Payment record for penalty fee deducted from deposit (300,000 VND)
INSERT INTO payments (
    id, created_at, updated_at, transaction_id, contract_id,
    amount, payment_type, status, payment_method, payment_time, confirmed_at,
    payment_notes
)
SELECT
    'a0000007-0001-0000-0000-000000000002',
    NOW(), NOW(),
    'PENALTY-DEDUCT-CTR-D7-GRACE-02',
    'c0000007-0001-0000-0000-000000000002',
    300000.00,
    'EXTRA_CHARGE',
    'PAID',
    'DEPOSIT_DEDUCTION',
    '2026-11-05 08:18:34',
    '2026-11-05 08:18:34',
    'Khấu trừ phí phạt trễ hạn từ tiền cọc hợp đồng CTR-D7-GRACE-02'
WHERE NOT EXISTS (
    SELECT 1 FROM payments WHERE transaction_id = 'PENALTY-DEDUCT-CTR-D7-GRACE-02'
);

-- 2. Insert RefundRequest record for deposit return to customer (1,500,000 VND)
INSERT INTO refund_requests (
    id, created_at, updated_at, request_code, customer_id, facility_id, contract_id,
    requested_amount, deduction_amount, final_refund_amount,
    bank_name, bank_account_number, bank_account_name, reason, status,
    requested_by_id, reviewed_by_id, reviewed_at, processed_at, process_notes
)
SELECT
    'b0000007-0001-0000-0000-000000000002',
    NOW(), NOW(),
    'REF-SETTLE-CTR-D7-GRACE-02',
    'e0000000-0000-0000-0000-000000000008',
    '45e03ded-5da1-43d5-bea7-96c645d5f96c',
    'c0000007-0001-0000-0000-000000000002',
    1800000.00,
    300000.00,
    1500000.00,
    'Chuyển khoản / Quầy',
    'N/A',
    'Lê Thị Hoàng Yến',
    'Quyết toán nợ cước và hoàn tiền cọc hợp đồng CTR-D7-GRACE-02 (Cọc: 1.800.000 đ, Khấu trừ phạt: 300.000 đ)',
    'COMPLETED',
    COALESCE((SELECT id FROM users WHERE email = 'business@gmail.com' LIMIT 1), 'e0000000-0000-0000-0000-000000000091'),
    COALESCE((SELECT id FROM users WHERE email = 'business@gmail.com' LIMIT 1), 'e0000000-0000-0000-0000-000000000091'),
    '2026-11-05 08:18:34',
    '2026-11-05 08:18:34',
    'Hoàn tất quyết toán cấn trừ cọc và trả kho'
WHERE NOT EXISTS (
    SELECT 1 FROM refund_requests WHERE request_code = 'REF-SETTLE-CTR-D7-GRACE-02'
);
