-- ==============================================================================
-- Migration V105: Add temp_access_pin column to rental_contracts
-- Stores temporary 6-digit access PIN granted by managers for 24 hours
-- ==============================================================================

ALTER TABLE rental_contracts 
    ADD COLUMN IF NOT EXISTS temp_access_pin VARCHAR(50);
