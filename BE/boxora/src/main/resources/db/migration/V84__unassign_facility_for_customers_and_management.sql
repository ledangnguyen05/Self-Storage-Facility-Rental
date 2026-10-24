-- V84: Unassign branch/facility for CUSTOMER, ADMIN, SYSTEM_ADMIN, and BUSINESS_MANAGER roles.
-- Only STAFF and FACILITY_MANAGER are scoped to specific facilities.

UPDATE users
SET facility_id = NULL
WHERE role_id IN (
    SELECT id FROM roles WHERE name IN ('CUSTOMER', 'ADMIN', 'SYSTEM_ADMIN', 'BUSINESS_MANAGER')
);
