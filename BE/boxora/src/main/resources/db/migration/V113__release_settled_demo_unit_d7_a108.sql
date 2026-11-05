-- ==============================================================================
-- Migration V113: Release unit D7-A108 to AVAILABLE after contract CTR-D7-GRACE-02
-- was settled and terminated
-- ==============================================================================

UPDATE storage_units
SET status = 'AVAILABLE', updated_at = NOW()
WHERE (unit_code = 'D7-A108' OR id = 'b9e35b7e-4f70-45ce-a26e-e875d70c8794')
  AND status = 'OCCUPIED';

