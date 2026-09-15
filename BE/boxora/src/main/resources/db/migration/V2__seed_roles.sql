INSERT INTO roles
(
    id,
    created_at,
    updated_at,
    name,
    description,
    is_active
)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        'ADMIN',
        'System administrator',
        TRUE
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        'FACILITY_MANAGER',
        'Facility manager',
        TRUE
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        'BUSINESS_MANAGER',
        'Business manager',
        TRUE
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        'STAFF',
        'Store staff',
        TRUE
    ),
    (
        '55555555-5555-5555-5555-555555555555',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        'CUSTOMER',
        'Store customer',
        TRUE
    )
    ON CONFLICT (name) DO NOTHING;