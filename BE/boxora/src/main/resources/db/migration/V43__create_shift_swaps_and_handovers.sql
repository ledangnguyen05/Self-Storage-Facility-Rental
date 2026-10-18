-- =========================================================================
-- V43: Schema & Seed for Work Shifts, Staff Check-in/out, Shift Swaps & Handovers
-- =========================================================================

-- 1. Extend staff_assignments with attendance and shift time windows
ALTER TABLE staff_assignments
    ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS start_time TIME,
    ADD COLUMN IF NOT EXISTS end_time TIME,
    ADD COLUMN IF NOT EXISTS check_in_note VARCHAR(255),
    ADD COLUMN IF NOT EXISTS check_out_note VARCHAR(255);

-- 2. Create table shift_swap_requests
CREATE TABLE IF NOT EXISTS shift_swap_requests
(
    id                   UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assignment_id        UUID                     NOT NULL REFERENCES staff_assignments(id) ON DELETE CASCADE,
    target_assignment_id UUID                     REFERENCES staff_assignments(id) ON DELETE SET NULL,
    requester_id         UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_staff_id      UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    facility_id          UUID                     NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    reason               TEXT                     NOT NULL,
    status               VARCHAR(30)              NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
    reviewed_by_id       UUID                     REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at          TIMESTAMP WITH TIME ZONE,
    manager_notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_ssr_facility_status ON shift_swap_requests(facility_id, status);
CREATE INDEX IF NOT EXISTS idx_ssr_requester ON shift_swap_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_ssr_target_staff ON shift_swap_requests(target_staff_id);

-- 3. Create table shift_handovers
CREATE TABLE IF NOT EXISTS shift_handovers
(
    id                         UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    facility_id                UUID                     NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    handover_date              DATE                     NOT NULL,
    shift                      VARCHAR(30)              NOT NULL, -- MORNING, AFTERNOON, NIGHT, FULL_DAY
    outgoing_staff_id          UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    incoming_staff_id          UUID                     REFERENCES users(id) ON DELETE SET NULL,
    outgoing_assignment_id     UUID                     REFERENCES staff_assignments(id) ON DELETE SET NULL,
    incoming_assignment_id     UUID                     REFERENCES staff_assignments(id) ON DELETE SET NULL,
    pending_tasks              TEXT,
    pending_tickets_count      INT                      NOT NULL DEFAULT 0,
    unresolved_bookings_count  INT                      NOT NULL DEFAULT 0,
    cash_in_drawer             NUMERIC(12, 2)           NOT NULL DEFAULT 0.00,
    facility_status_note       TEXT,
    checklist_completed        BOOLEAN                  NOT NULL DEFAULT FALSE,
    notes                      TEXT,
    status                     VARCHAR(30)              NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, ACKNOWLEDGED, REJECTED
    acknowledged_at            TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sh_facility_date ON shift_handovers(facility_id, handover_date);
CREATE INDEX IF NOT EXISTS idx_sh_outgoing_staff ON shift_handovers(outgoing_staff_id);
CREATE INDEX IF NOT EXISTS idx_sh_incoming_staff ON shift_handovers(incoming_staff_id);

-- 4. Seed operational shift assignments for TODAY across 4 facilities
-- Ensure start_time / end_time and realistic attendance states (some CHECKED_IN, some ASSIGNED)

-- Tan Binh Mega Hub (a1111111-2222-3333-4444-555555555555)
-- Staff: staff1_tb, staff2_tb, staff3_tb
INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, checked_in_at, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'MORNING', '06:00:00'::TIME, '14:00:00'::TIME,
    'Khu A - Quầy tiếp tân & Kho tầng trệt', 'PRIMARY_STAFF',
    'CHECKED_IN', CURRENT_TIMESTAMP - INTERVAL '3 hours',
    mgr.id, 'Ca sáng: tiếp đón khách nhận kho và đối soát SmartLock'
FROM users u
JOIN facilities f ON f.code = 'HCM-TB'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff1_tb'
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'AFTERNOON', '14:00:00'::TIME, '22:00:00'::TIME,
    'Khu B - Kho mát & Hành lang tầng 2', 'PRIMARY_STAFF',
    'ASSIGNED', mgr.id, 'Ca chiều: bàn giao kho mới, kiểm tra nhiệt ẩm độ'
FROM users u
JOIN facilities f ON f.code = 'HCM-TB'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff2_tb'
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'NIGHT', '22:00:00'::TIME, '06:00:00'::TIME,
    'Toàn bộ khuôn viên cơ sở Tân Bình', 'SUPERVISOR',
    'ASSIGNED', mgr.id, 'Ca đêm: giám sát an ninh camera, tuần tra cửa kho khóa thông minh'
FROM users u
JOIN facilities f ON f.code = 'HCM-TB'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff3_tb'
ON CONFLICT (id) DO NOTHING;

-- District 1 (f7af2794-0d0d-4c68-9e36-c44bf3034f6c)
-- Staff: staff1_q1, staff2_q1, staff3_q1
INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, checked_in_at, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'MORNING', '06:00:00'::TIME, '14:00:00'::TIME,
    'Sảnh chính & Kho Zone 1', 'PRIMARY_STAFF',
    'CHECKED_IN', CURRENT_TIMESTAMP - INTERVAL '2 hours',
    mgr.id, 'Ca sáng Q1: đón khách VIP, ký hợp đồng giấy bổ sung'
FROM users u
JOIN facilities f ON f.code = 'HCM-D1'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff1_q1'
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'AFTERNOON', '14:00:00'::TIME, '22:00:00'::TIME,
    'Zone 2 & Bãi bốc dỡ hàng', 'PRIMARY_STAFF',
    'ASSIGNED', mgr.id, 'Ca chiều Q1: hỗ trợ đối tác bốc dỡ, trực hotline chi nhánh'
FROM users u
JOIN facilities f ON f.code = 'HCM-D1'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff2_q1'
ON CONFLICT (id) DO NOTHING;

-- District 7 (45e03ded-5da1-43d5-bea7-96c645d5f96c)
-- Staff: staff1_q7, staff2_q7
INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, checked_in_at, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'MORNING', '06:00:00'::TIME, '14:00:00'::TIME,
    'Quầy dịch vụ & Kho Block A', 'PRIMARY_STAFF',
    'CHECKED_IN', CURRENT_TIMESTAMP - INTERVAL '3 hours 30 mins',
    mgr.id, 'Ca sáng Q7: tiếp nhận khách nước ngoài, xuất hóa đơn VAT'
FROM users u
JOIN facilities f ON f.code = 'HCM-D7'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff1_q7'
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'AFTERNOON', '14:00:00'::TIME, '22:00:00'::TIME,
    'Block B & Khu lưu trữ đồ điện tử', 'PRIMARY_STAFF',
    'ASSIGNED', mgr.id, 'Ca chiều Q7: nghiệm thu trả kho và kiểm tra niêm phong'
FROM users u
JOIN facilities f ON f.code = 'HCM-D7'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff2_q7'
ON CONFLICT (id) DO NOTHING;

-- Thu Duc (fd8f948e-fdff-4a81-ad0f-fc45639b545d)
-- Staff: staff1_td, staff2_td
INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, checked_in_at, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'MORNING', '06:00:00'::TIME, '14:00:00'::TIME,
    'Quầy điều hành & Kho tầng 1', 'PRIMARY_STAFF',
    'CHECKED_IN', CURRENT_TIMESTAMP - INTERVAL '1 hour',
    mgr.id, 'Ca sáng Thủ Đức: xử lý đặt chỗ mới và tiếp nhận kiểm thử thiết bị'
FROM users u
JOIN facilities f ON f.code = 'HCM-TD'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff1_td'
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff_assignments (
    id, created_at, updated_at, staff_id, facility_id, assigned_date,
    shift, start_time, end_time, assigned_zone, role_in_shift,
    status, assigned_by_id, notes
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    u.id, f.id, CURRENT_DATE,
    'AFTERNOON', '14:00:00'::TIME, '22:00:00'::TIME,
    'Kho hàng lớn & Sân container', 'PRIMARY_STAFF',
    'ASSIGNED', mgr.id, 'Ca chiều Thủ Đức: điều phối xe tải giao nhận'
FROM users u
JOIN facilities f ON f.code = 'HCM-TD'
LEFT JOIN users mgr ON mgr.role_id IN (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER') AND mgr.facility_id = f.id
WHERE u.username = 'staff2_td'
ON CONFLICT (id) DO NOTHING;

-- 5. Seed a sample shift handover record for demonstration
INSERT INTO shift_handovers (
    id, created_at, updated_at, facility_id, handover_date, shift,
    outgoing_staff_id, incoming_staff_id, pending_tasks,
    pending_tickets_count, unresolved_bookings_count, cash_in_drawer,
    facility_status_note, checklist_completed, notes, status, acknowledged_at
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day',
    f.id, CURRENT_DATE - INTERVAL '1 day', 'MORNING',
    s1.id, s2.id,
    'Bàn giao khách hàng công ty A hẹn thanh toán tiền mặt lúc 14:30. Khóa kho B104 pin yếu cần theo dõi.',
    1, 2, 1500000.00,
    'Hệ thống camera giám sát hành lang hoạt động bình thường, quạt thông gió tầng 2 bật chế độ tự động.',
    TRUE,
    'Đã bàn giao chìa khóa dự phòng và tiền thu ngân tại quầy.',
    'ACKNOWLEDGED', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '30 mins'
FROM facilities f
JOIN users s1 ON s1.username = 'staff1_tb'
JOIN users s2 ON s2.username = 'staff2_tb'
WHERE f.code = 'HCM-TB'
LIMIT 1
ON CONFLICT (id) DO NOTHING;
