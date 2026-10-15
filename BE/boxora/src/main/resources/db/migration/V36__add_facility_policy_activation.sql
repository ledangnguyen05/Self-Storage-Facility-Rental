ALTER TABLE facility_policies
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE facility_policy_exception_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    facility_policy_id UUID NOT NULL REFERENCES facility_policies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by_user_id UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_facility_policy_exception_grant UNIQUE (facility_policy_id, user_id)
);
