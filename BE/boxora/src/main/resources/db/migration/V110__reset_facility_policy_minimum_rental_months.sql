-- V110: Standardize minimum rental months to 1 for all facility policies
-- (Removing minimum rental months restriction from operational policy config)
UPDATE facility_policies
SET minimum_rental_months = 1
WHERE minimum_rental_months IS NULL OR minimum_rental_months > 1;

UPDATE facility_policies
SET minimum_rental_days = 30
WHERE minimum_rental_days IS NULL OR minimum_rental_days > 30;

