-- =========================================================================
-- V11: Seed Facilities
-- =========================================================================

INSERT INTO facilities (id, created_at, updated_at, name, code, address, city, contact_phone, email, status, open_time, close_time, description)
VALUES 
    ('a1111111-2222-3333-4444-555555555555', NOW(), NOW(), 'StoreHub Tan Binh Mega Hub', 'HCM-TB', '102 Truong Son, Ward 2, Tan Binh District', 'Ho Chi Minh City', '0904567890', 'tanbinh@boxora.vn', 'ACTIVE', '08:00:00', '21:00:00', 'Cơ sở trung tâm tiếp giáp sân bay Tân Sơn Nhất, phục vụ lưu kho cá nhân và kho thương mại điện tử 24/7.')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, address = EXCLUDED.address, status = EXCLUDED.status;
