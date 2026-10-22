-- V81: Add image_url to storage_units and facilities for Cloudflare R2 images
ALTER TABLE storage_units
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000);

ALTER TABLE facilities
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000);

CREATE INDEX IF NOT EXISTS idx_storage_units_image_url ON storage_units(image_url);
