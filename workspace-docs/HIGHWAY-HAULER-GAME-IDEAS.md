# Highway Hauler — Weekend Polish Ideas

Backlog of fun/low-priority improvements for the maintenance-page mini-game
(`components/TruckingGame.tsx`). Pick these up during off-hours or a weekend —
none are urgent.

## Requested / agreed enhancements

- **Delivery streak multiplier** — Award escalating bonuses for consecutive
  deliveries without crashing (e.g. 2x, 3x). Reset the multiplier on a crash or
  a missed BOL.
- **Distinct cargo types** — Different freight worth different points (e.g.
  general freight vs. oversize/heavy-haul vs. hazmat), shown as different crate
  colors on the trailer and different paperwork badges.
- **Sound toggle** — Optional SFX for pickup, delivery, and crash, with a mute
  toggle persisted to `localStorage`. Keep it off by default.

## Other nice-to-haves (stretch)

- Subtle difficulty tiers with on-screen "Level up" flashes as speed ramps.
- Day/night road palette that shifts the longer you drive.
- Server-backed leaderboard (company-wide) instead of `localStorage`-only, so
  scores are shared. Would need a small table + an API route.
- Tiny tutorial overlay on first play explaining rate con → BOL flow.

## Current state (already shipped)

- Pick up **rate cons** (orange `$` paperwork) to load up; deliver to **BOLs**
  (green check paperwork) for +25 pts. Freight crates render on the trailer
  while loaded and disappear on delivery.
- Difficulty ramps over time (faster speed cap, denser truck spawns).
- Local top-7 **high-score** side panel with 3-letter initials entry
  (`localStorage` key `nts_truck_game_scores`).
- Admins can **preview** the maintenance page and **toggle** the game on/off
  from the Maintenance tab (`maintenance_show_game` in `app_settings`).
