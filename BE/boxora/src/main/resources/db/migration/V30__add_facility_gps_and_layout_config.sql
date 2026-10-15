ALTER TABLE facilities
    ADD COLUMN latitude NUMERIC(10, 7),
    ADD COLUMN longitude NUMERIC(10, 7),
    ADD COLUMN layout_config TEXT;
