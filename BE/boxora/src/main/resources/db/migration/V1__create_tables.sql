-- =========================================================
-- ROLES
-- =========================================================

CREATE TABLE IF NOT EXISTS roles
(
    id          UUID         NOT NULL,
    created_at  TIMESTAMP    NOT NULL,
    updated_at  TIMESTAMP    NOT NULL,
    name        VARCHAR(50)  NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL,

    CONSTRAINT pk_roles PRIMARY KEY (id),
    CONSTRAINT uc_roles_name UNIQUE (name)
    );


-- =========================================================
-- PERMISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS permissions
(
    id                UUID         NOT NULL,
    created_at        TIMESTAMP    NOT NULL,
    updated_at        TIMESTAMP    NOT NULL,
    name              VARCHAR(255) NOT NULL,
    permission_group  VARCHAR(255) NOT NULL,
    description       VARCHAR(255),
    is_active         BOOLEAN      NOT NULL,

    CONSTRAINT pk_permissions PRIMARY KEY (id),
    CONSTRAINT uc_permissions_name UNIQUE (name)
    );


-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users
(
    id           UUID         NOT NULL,
    created_at   TIMESTAMP    NOT NULL,
    updated_at   TIMESTAMP    NOT NULL,
    username     VARCHAR(30)  NOT NULL,
    email        VARCHAR(255) NOT NULL,
    password     VARCHAR(255) NOT NULL,
    phone        VARCHAR(20)  NOT NULL,
    full_name    VARCHAR(30),
    is_active    BOOLEAN      NOT NULL,
    avatar       VARCHAR(255),
    assigned_by  UUID,
    assigned_at  TIMESTAMP,
    role_id      UUID,

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uc_users_username UNIQUE (username),
    CONSTRAINT uc_users_email UNIQUE (email),

    CONSTRAINT fk_users_role
    FOREIGN KEY (role_id)
    REFERENCES roles(id),

    CONSTRAINT fk_users_assigned_by
    FOREIGN KEY (assigned_by)
    REFERENCES users(id)
    );


-- =========================================================
-- REFRESH TOKENS
-- =========================================================

CREATE TABLE IF NOT EXISTS refresh_tokens
(
    id            UUID         NOT NULL,
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    user_id       UUID         NOT NULL,
    token         VARCHAR(255) NOT NULL,
    type          VARCHAR(255) NOT NULL,
    expired_at    TIMESTAMP    NOT NULL,
    last_used_at  TIMESTAMP    NOT NULL,
    revoked       BOOLEAN      NOT NULL,

    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uc_refresh_tokens_token UNIQUE (token),

    CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    );


-- =========================================================
-- ROLE PERMISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS role_permissions
(
    id             UUID         NOT NULL,
    created_at     TIMESTAMP    NOT NULL,
    updated_at     TIMESTAMP    NOT NULL,
    role_id        UUID         NOT NULL,
    permission_id  UUID         NOT NULL,
    is_active      BOOLEAN      NOT NULL,
    description    VARCHAR(255),

    CONSTRAINT pk_role_permissions PRIMARY KEY (id),

    CONSTRAINT uc_role_permissions_role_permission
    UNIQUE (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id)
    REFERENCES roles(id),

    CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id)
    REFERENCES permissions(id)
    );


-- =========================================================
-- FACILITIES
-- =========================================================

CREATE TABLE IF NOT EXISTS facilities
(
    id             UUID         NOT NULL,
    created_at     TIMESTAMP    NOT NULL,
    updated_at     TIMESTAMP    NOT NULL,
    name           VARCHAR(150) NOT NULL,
    address        VARCHAR(255) NOT NULL,
    city           VARCHAR(50),
    contact_phone  VARCHAR(20),

    CONSTRAINT pk_facilities PRIMARY KEY (id)
    );


-- =========================================================
-- UNIT TYPES
-- =========================================================

CREATE TABLE IF NOT EXISTS unit_types
(
    id                    UUID           NOT NULL,
    created_at            TIMESTAMP      NOT NULL,
    updated_at            TIMESTAMP      NOT NULL,
    type_name             VARCHAR(100)   NOT NULL,
    dimensions            VARCHAR(50)    NOT NULL,
    area_sqm              DOUBLE PRECISION NOT NULL,
    base_price_per_month  NUMERIC(12,2)  NOT NULL,
    deposit_amount        NUMERIC(12,2)  NOT NULL,

    CONSTRAINT pk_unit_types PRIMARY KEY (id)
    );


-- =========================================================
-- STORAGE UNITS
-- =========================================================

CREATE TABLE IF NOT EXISTS storage_units
(
    id             UUID        NOT NULL,
    created_at     TIMESTAMP   NOT NULL,
    updated_at     TIMESTAMP   NOT NULL,
    unit_code      VARCHAR(30) NOT NULL,
    floor_level    VARCHAR(50),
    status         VARCHAR(30) NOT NULL,
    facility_id    UUID        NOT NULL,
    unit_type_id   UUID        NOT NULL,

    CONSTRAINT pk_storage_units PRIMARY KEY (id),

    CONSTRAINT fk_storage_units_facility
    FOREIGN KEY (facility_id)
    REFERENCES facilities(id),

    CONSTRAINT fk_storage_units_unit_type
    FOREIGN KEY (unit_type_id)
    REFERENCES unit_types(id)
    );


-- =========================================================
-- FACILITY POLICIES
-- =========================================================

CREATE TABLE IF NOT EXISTS facility_policies
(
    id                       UUID           NOT NULL,
    created_at               TIMESTAMP      NOT NULL,
    updated_at               TIMESTAMP      NOT NULL,
    facility_id              UUID           NOT NULL,
    deposit_percentage       DOUBLE PRECISION NOT NULL,
    daily_late_fee           NUMERIC(12,2)  NOT NULL,
    cancellation_refund_days INTEGER        NOT NULL,

    CONSTRAINT pk_facility_policies PRIMARY KEY (id),

    CONSTRAINT uc_facility_policies_facility
    UNIQUE (facility_id),

    CONSTRAINT fk_facility_policies_facility
    FOREIGN KEY (facility_id)
    REFERENCES facilities(id)
    );


-- =========================================================
-- BOOKINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS bookings
(
    id                       UUID         NOT NULL,
    created_at               TIMESTAMP    NOT NULL,
    updated_at               TIMESTAMP    NOT NULL,
    booking_code             VARCHAR(30)  NOT NULL,
    customer_id              UUID         NOT NULL,
    storage_unit_id          UUID         NOT NULL,
    start_date               DATE         NOT NULL,
    end_date                 DATE         NOT NULL,
    rental_months            INTEGER      NOT NULL,
    total_rental_fee         NUMERIC(12,2) NOT NULL,
    deposit_paid             NUMERIC(12,2) NOT NULL,
    status                   VARCHAR(30)  NOT NULL,
    access_code              VARCHAR(20),
    handed_over_by_staff_id  UUID,
    handover_time            TIMESTAMP,
    return_time              TIMESTAMP,
    access_pin               VARCHAR(10),
    qr_access_token          VARCHAR(255),
    pin_updated_at           TIMESTAMP,

    CONSTRAINT pk_bookings PRIMARY KEY (id),

    CONSTRAINT uc_bookings_booking_code
    UNIQUE (booking_code),

    CONSTRAINT fk_bookings_customer
    FOREIGN KEY (customer_id)
    REFERENCES users(id),

    CONSTRAINT fk_bookings_storage_unit
    FOREIGN KEY (storage_unit_id)
    REFERENCES storage_units(id),

    CONSTRAINT fk_bookings_staff
    FOREIGN KEY (handed_over_by_staff_id)
    REFERENCES users(id)
    );


-- =========================================================
-- PAYMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS payments
(
    id              UUID          NOT NULL,
    created_at      TIMESTAMP     NOT NULL,
    updated_at      TIMESTAMP     NOT NULL,
    transaction_id  VARCHAR(60)   NOT NULL,
    booking_id      UUID          NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    payment_type    VARCHAR(30)   NOT NULL,
    status          VARCHAR(30)   NOT NULL,
    payment_method  VARCHAR(50),
    payment_time    TIMESTAMP     NOT NULL,

    CONSTRAINT pk_payments PRIMARY KEY (id),

    CONSTRAINT uc_payments_transaction_id
    UNIQUE (transaction_id),

    CONSTRAINT fk_payments_booking
    FOREIGN KEY (booking_id)
    REFERENCES bookings(id)
    );


-- =========================================================
-- HANDOVER RECORDS
-- =========================================================

CREATE TABLE IF NOT EXISTS handover_records
(
    id             UUID        NOT NULL,
    created_at     TIMESTAMP   NOT NULL,
    updated_at     TIMESTAMP   NOT NULL,
    booking_id     UUID        NOT NULL,
    staff_id       UUID        NOT NULL,
    record_type    VARCHAR(30) NOT NULL,
    unit_condition TEXT,
    notes          TEXT,
    recorded_at    TIMESTAMP   NOT NULL,

    CONSTRAINT pk_handover_records PRIMARY KEY (id),

    CONSTRAINT fk_handover_records_booking
    FOREIGN KEY (booking_id)
    REFERENCES bookings(id),

    CONSTRAINT fk_handover_records_staff
    FOREIGN KEY (staff_id)
    REFERENCES users(id)
    );


-- =========================================================
-- ACTIVITY LOGS
-- =========================================================

CREATE TABLE IF NOT EXISTS activity_logs
(
    id          UUID         NOT NULL,
    created_at  TIMESTAMP    NOT NULL,
    updated_at  TIMESTAMP    NOT NULL,
    user_id     UUID,
    username    VARCHAR(50),
    action      VARCHAR(100) NOT NULL,
    details     TEXT,
    ip_address  VARCHAR(45),
    timestamp   TIMESTAMP    NOT NULL,

    CONSTRAINT pk_activity_logs PRIMARY KEY (id),

    CONSTRAINT fk_activity_logs_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    );

-- =========================================================
-- SUPPORT_TICKETS
-- =========================================================
CREATE TABLE IF NOT EXISTS support_tickets
(
    id                  UUID         NOT NULL,
    ticket_code         VARCHAR(50)  NOT NULL,
    user_id             UUID         NOT NULL,
    booking_id          UUID,
    category            VARCHAR(50)  NOT NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT         NOT NULL,
    status              VARCHAR(30)  NOT NULL DEFAULT 'OPEN',
    priority            VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    assigned_staff_id   UUID,
    resolution_note     TEXT,
    created_at          TIMESTAMP    NOT NULL,
    updated_at          TIMESTAMP    NOT NULL,

    CONSTRAINT pk_support_tickets
    PRIMARY KEY (id),

    CONSTRAINT uc_support_tickets_code
    UNIQUE (ticket_code),

    CONSTRAINT fk_support_tickets_user
    FOREIGN KEY (user_id)
    REFERENCES users(id),

    CONSTRAINT fk_support_tickets_booking
    FOREIGN KEY (booking_id)
    REFERENCES bookings(id),

    CONSTRAINT fk_support_tickets_staff
    FOREIGN KEY (assigned_staff_id)
    REFERENCES users(id)
    );