-- Optional workout duration on a check-in, in minutes. Powers hours-based
-- goals and the My Stats screen. Nullable so crews that don't track hours
-- (or check-ins made before this) simply have no duration.
alter table check_ins add column if not exists duration_min int
  check (duration_min is null or (duration_min >= 0 and duration_min <= 600));
