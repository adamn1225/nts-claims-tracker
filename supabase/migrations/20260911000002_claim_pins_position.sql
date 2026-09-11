-- Manual sort order for a user's pinned claims (drag-reorder on the kanban
-- board). Existing pins default to 0; the pin API assigns the next position
-- for new pins going forward.
alter table public.claim_pins
  add column position integer not null default 0;

comment on column public.claim_pins.position is
  'Manual sort order among a user''s pinned claims (lower = higher on the board).';
