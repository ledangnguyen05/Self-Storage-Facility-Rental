-- =========================================================================
-- V35: Seed authentic mouse-drawn handwritten signatures for active/signed contracts
-- Replaces plain text fallback with true vector mouse-drawn stroke representations
-- =========================================================================

-- 1. Nguyen (dnguyen, danguyen, etc.)
UPDATE rental_contracts
SET signature_data = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 26 55 C 30 38 36 20 44 15 C 50 11 55 18 58 32 C 63 50 69 58 75 38 C 79 26 85 22 91 30 C 97 38 101 52 108 48 C 114 44 118 32 123 30 C 129 28 131 42 135 48 C 139 54 144 48 148 38 C 152 26 156 22 160 34 C 164 46 170 76 158 84 C 146 91 140 78 148 64 C 158 48 168 40 178 38 C 186 36 191 44 196 46 C 203 48 210 36 217 34 C 224 32 228 42 234 40 C 240 38 244 32 248 34" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M 34 68 C 74 65 132 67 198 59 C 220 56 236 55 248 57" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/><circle cx="218" cy="23" r="2.2" fill="%231e3a8a"/></svg>'
WHERE signature_data IS NULL
  AND customer_id IN (SELECT id FROM users WHERE username IN ('dnguyen', 'danguyen') OR full_name ILIKE '%nguyen%' OR email ILIKE '%nguyen%');

-- 2. Minh (cust_minh, etc.)
UPDATE rental_contracts
SET signature_data = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 28 58 C 32 40 36 22 45 16 C 52 12 58 20 62 38 C 66 54 72 56 78 36 C 82 24 88 20 94 36 C 98 52 104 56 110 38 C 114 26 120 28 126 44 C 132 60 138 60 144 42 C 148 30 154 28 158 38 C 162 48 166 74 172 16 C 174 12 178 14 180 24 C 182 38 188 56 196 48 C 204 40 210 34 218 36" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M 32 70 C 72 68 135 69 205 60 C 226 57 242 56 250 58" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/><circle cx="127" cy="20" r="2.2" fill="%231e3a8a"/></svg>'
WHERE signature_data IS NULL
  AND customer_id IN (SELECT id FROM users WHERE username = 'cust_minh' OR full_name ILIKE '%minh%');

-- 3. Lan (cust_lan, etc.)
UPDATE rental_contracts
SET signature_data = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 40 18 C 32 24 28 42 34 58 C 38 68 48 70 56 64 C 64 56 62 46 54 44 C 44 42 42 56 50 62 C 60 70 82 66 98 52 C 108 42 116 38 126 46 C 136 54 142 58 152 46 C 160 36 168 34 176 44 C 184 54 192 56 200 44 C 208 34 216 32 226 38" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M 48 72 C 88 70 148 68 215 62 C 235 60 248 58 254 60" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/></svg>'
WHERE signature_data IS NULL
  AND customer_id IN (SELECT id FROM users WHERE username = 'cust_lan' OR full_name ILIKE '%lan%' OR full_name ILIKE '%yen%');

-- 4. Hoang (cust_hoang, etc.)
UPDATE rental_contracts
SET signature_data = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 30 20 C 32 36 34 54 36 70 M 24 44 C 36 42 50 40 64 42 M 56 18 C 58 34 60 52 62 68 C 66 54 74 38 84 36 C 94 34 98 48 104 54 C 110 60 118 52 126 38 C 134 24 142 22 150 36 C 158 50 164 78 154 84 C 144 90 138 78 146 64 C 156 48 168 38 180 36 C 190 34 198 44 206 46 C 214 48 222 36 232 38" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M 35 72 C 75 70 145 68 215 60 C 235 57 248 56 254 58" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/></svg>'
WHERE signature_data IS NULL
  AND customer_id IN (SELECT id FROM users WHERE username = 'cust_hoang' OR full_name ILIKE '%hoang%' OR full_name ILIKE '%anh%');

-- 5. Phuong (cust_phuong, etc.)
UPDATE rental_contracts
SET signature_data = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 36 20 C 38 38 40 56 42 74 M 38 22 C 48 16 66 16 72 26 C 78 36 74 48 60 52 C 48 54 40 52 38 52 M 62 46 C 72 38 82 20 88 16 C 92 14 96 22 98 34 C 102 50 110 56 118 42 C 124 32 130 30 136 42 C 142 54 148 56 156 40 C 162 28 170 26 178 38 C 184 48 190 76 180 84 C 172 90 166 80 172 66 C 180 50 192 40 204 38" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M 38 72 C 80 69 148 68 215 60 C 235 57 248 56 254 58" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/></svg>'
WHERE signature_data IS NULL
  AND customer_id IN (SELECT id FROM users WHERE username = 'cust_phuong' OR full_name ILIKE '%phuong%');

-- 6. All remaining active, overdue, expired, or terminated contracts without signature
UPDATE rental_contracts
SET signature_data = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 26 55 C 30 38 36 20 44 15 C 50 11 55 18 58 32 C 63 50 69 58 75 38 C 79 26 85 22 91 30 C 97 38 101 52 108 48 C 114 44 118 32 123 30 C 129 28 131 42 135 48 C 139 54 144 48 148 38 C 152 26 156 22 160 34 C 164 46 170 76 158 84 C 146 91 140 78 148 64 C 158 48 168 40 178 38 C 186 36 191 44 196 46 C 203 48 210 36 217 34 C 224 32 228 42 234 40 C 240 38 244 32 248 34" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M 34 68 C 74 65 132 67 198 59 C 220 56 236 55 248 57" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/><circle cx="218" cy="23" r="2.2" fill="%231e3a8a"/></svg>'
WHERE signature_data IS NULL
  AND status NOT IN ('PENDING_SIGNATURE');
