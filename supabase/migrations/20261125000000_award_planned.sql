-- New award state: chosen by the contractor but NOT yet sent to the sub-contractor.
-- Sub-contractors are only told once the homeowner accepts the quote.
-- (Kept in its own migration: a new enum value can't be used in the same transaction.)
alter type award_status add value if not exists 'planned' before 'offered';
