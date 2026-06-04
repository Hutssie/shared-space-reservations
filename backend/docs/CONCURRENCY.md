# Concurrency and booking correctness

This document describes how the API prevents inconsistent bookings when multiple requests run at the same time.

## Problems we address

| Scenario | Risk without protection |
|----------|-------------------------|
| **Guest vs guest** | Two users reserve the same confirmed time slot; both pass a “check then insert” flow and both succeed. |
| **Guest vs host (rules)** | Host blocks a date or changes listing rules while a guest’s request is in flight; guest books on outdated rules. |
| **Guest vs host (status)** | Host sets a listing to `inactive` while a guest submits a booking based on an earlier “active” view. |
| **Host confirm** | Host approves a pending request after the slot was already confirmed for someone else, or after the date was blocked. |

---

## 1. Guest vs guest — PostgreSQL exclusion constraint

**Invariant:** For a given space and date, two **confirmed** bookings cannot have overlapping time ranges.

**Implementation:**

- Each booking stores `start_minutes` and `end_minutes` (half-open range `[start, end)` in minutes).
- Migration `booking_exclusion_constraint` adds a partial GiST exclusion constraint `bookings_no_confirmed_overlap` on `(space_id, date, int4range(start_minutes, end_minutes))` where `status = 'confirmed'`.
- `POST /api/bookings` and host `PATCH` (confirm) do not rely on application-level overlap checks; the database rejects conflicting inserts/updates with SQL state `23P01`.
- The API maps that error to **409** with message: `Time slot is already booked`.

**Note:** Multiple **pending** requests for the same slot are still allowed; only **confirmed** rows are constrained.

**Verify locally:** `npm run db:verify-exclusion`

---

## 2. Guest vs host — transactional row lock on the listing

**Invariant:** Booking rules are evaluated on the **current** listing row at commit time, not on a snapshot taken earlier in the request.

**Implementation:**

- `POST /api/bookings` runs inside `prisma.$transaction`:
  1. `SELECT id FROM "Space" WHERE id = $spaceId FOR UPDATE` — locks the listing row until the transaction ends.
  2. `validateBookingAgainstSpace` — re-checks `status === 'active'`, blocked dates, banned days, availability window, duration, and price.
  3. `booking.create` — insert (still subject to the exclusion constraint if status is `confirmed`).

If the host updates `blockedDatesJson`, `status`, or other rules in parallel, their transaction either completes before the guest’s validation (guest sees new rules) or waits until the guest’s booking finishes.

**Code:** [`src/lib/bookingRules.js`](../src/lib/bookingRules.js) (`lockSpaceRow`, `validateBookingAgainstSpace`), [`src/routes/bookings.js`](../src/routes/bookings.js) (`POST /`).

---

## 3. Host confirm — same lock + constraint

When a host sets `status: 'confirmed'` on a pending booking:

- The same transaction pattern locks the space row and re-runs `validateBookingAgainstSpace` (listing must still be active; date must not be blocked; times must still be valid).
- Updating to `confirmed` is subject to `bookings_no_confirmed_overlap` (same **409** as instant book if the slot is taken).

**Code:** [`src/routes/bookings.js`](../src/routes/bookings.js) (`PATCH /:id`, host confirm branch).

---

## Summary

```text
Guest vs guest     → DB exclusion constraint (authoritative for overlaps)
Guest vs host      → FOR UPDATE on Space + validate + insert in one transaction
Host confirm       → FOR UPDATE + validate + confirm (exclusion applies on confirmed)
```

Prisma remains the ORM; PostgreSQL enforces overlap; transactions and row locks align listing rules with booking writes.

## Related commands

| Command | Purpose |
|---------|---------|
| `npm run db:verify-exclusion` | Two concurrent confirmed inserts; expect one failure (`23P01`) |
| `npm run db:backfill-minutes` | Backfill `start_minutes` / `end_minutes` before applying exclusion migration on old DBs |
| `npm run db:deploy` | Apply migrations (columns + constraint) |
