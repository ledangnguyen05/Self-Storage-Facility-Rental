-- Migration V91: Support ticket flow 7 enhancements (rating, feedback, system actions)
ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS rating INT,
    ADD COLUMN IF NOT EXISTS customer_feedback TEXT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_rating ON support_tickets(rating);
