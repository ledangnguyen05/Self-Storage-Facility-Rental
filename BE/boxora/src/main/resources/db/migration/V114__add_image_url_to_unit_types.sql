-- V114: Add image_url to unit_types for simulation/preview photo upload
ALTER TABLE unit_types ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000);

