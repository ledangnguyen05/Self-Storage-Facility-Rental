-- V28: Standardize legacy unit codes in District 7 to follow facility blueprint convention

UPDATE storage_units
SET unit_code = 'D7-C213', floor_level = 'Floor 2'
WHERE id = 'ddaf019b-817f-4441-bd8f-f04102dbd898';

UPDATE storage_units
SET unit_code = 'D7-C214', floor_level = 'Floor 2'
WHERE id = '99346a45-84c7-4c3b-92ba-534f7f8d7a5d';
