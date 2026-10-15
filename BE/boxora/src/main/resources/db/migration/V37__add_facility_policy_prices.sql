CREATE TABLE facility_policy_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    facility_policy_id UUID NOT NULL REFERENCES facility_policies(id) ON DELETE CASCADE,
    unit_type_id UUID NOT NULL REFERENCES unit_types(id),
    monthly_price NUMERIC(12, 2) NOT NULL CHECK (monthly_price >= 0),
    discount_3_month_percent DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (discount_3_month_percent BETWEEN 0 AND 100),
    discount_6_month_percent DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (discount_6_month_percent BETWEEN 0 AND 100),
    discount_12_month_percent DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (discount_12_month_percent BETWEEN 0 AND 100),
    CONSTRAINT uk_facility_policy_unit_type UNIQUE (facility_policy_id, unit_type_id)
);
