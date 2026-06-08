-- Legacy favorites backfilled with ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP use
-- PostgreSQL's fast-default path, so existing rows can read as "now()" on each
-- query and always sort above rows with physically stored timestamps.
-- Materialize and assign stable legacy timestamps; keep genuinely stored times.

WITH user_stats AS (
  SELECT
    user_id,
    COUNT(*) AS total,
    COUNT(DISTINCT created_at) AS distinct_ts,
    MAX(created_at) AS max_ts
  FROM "Favorite"
  GROUP BY user_id
),
max_ts_counts AS (
  SELECT user_id, created_at, COUNT(*) AS ts_count
  FROM "Favorite"
  GROUP BY user_id, created_at
),
classified AS (
  SELECT
    f.user_id,
    f.space_id,
    f.created_at,
    us.total,
    us.distinct_ts,
    us.max_ts,
    mtc.ts_count AS max_ts_count,
    ROW_NUMBER() OVER (PARTITION BY f.user_id ORDER BY f.space_id) AS legacy_rn
  FROM "Favorite" f
  JOIN user_stats us ON us.user_id = f.user_id
  LEFT JOIN max_ts_counts mtc
    ON mtc.user_id = f.user_id
   AND mtc.created_at = us.max_ts
)
UPDATE "Favorite" f
SET created_at = CASE
  WHEN c.distinct_ts = 1 THEN
    TIMESTAMP '2000-01-01 00:00:00' + (c.legacy_rn * INTERVAL '1 second')
  WHEN c.created_at = c.max_ts AND c.max_ts_count > 1 THEN
    TIMESTAMP '2000-01-01 00:00:00' + (c.legacy_rn * INTERVAL '1 second')
  ELSE c.created_at
END
FROM classified c
WHERE f.user_id = c.user_id
  AND f.space_id = c.space_id
  AND (
    c.distinct_ts = 1
    OR (c.created_at = c.max_ts AND c.max_ts_count > 1)
  );
