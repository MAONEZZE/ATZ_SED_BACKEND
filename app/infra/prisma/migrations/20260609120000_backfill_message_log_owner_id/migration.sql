-- Backfill owner_id on message_logs created before the dispatch worker
-- started copying ownerId from outbox_messages to message_logs.

-- Fix 1: logs linked to an event but missing owner_id → inherit from event owner
UPDATE "ATZ_SED"."message_logs" ml
SET owner_id = e.owner_id
FROM "ATZ_SED"."events" e
WHERE ml.event_id = e.id
  AND ml.owner_id IS NULL;

-- Fix 2: global-send logs (event_id IS NULL, owner_id IS NULL) → match the
-- outbox_message that produced this log via recipient + channel + timestamp
-- proximity (within 5 minutes), then take the outbox owner_id.
UPDATE "ATZ_SED"."message_logs" ml
SET owner_id = sub.owner_id
FROM (
  SELECT DISTINCT ON (ml2.id)
    ml2.id    AS log_id,
    om.owner_id
  FROM "ATZ_SED"."message_logs" ml2
  JOIN "ATZ_SED"."outbox_messages" om
    ON  om.recipient  = ml2.recipient
    AND om.channel    = ml2.channel
    AND om.owner_id   IS NOT NULL
    AND om.created_at BETWEEN ml2.created_at - INTERVAL '5 minutes'
                          AND ml2.created_at + INTERVAL '5 minutes'
  WHERE ml2.owner_id  IS NULL
    AND ml2.event_id  IS NULL
  ORDER BY ml2.id,
           ABS(EXTRACT(EPOCH FROM (om.created_at - ml2.created_at)))
) sub
WHERE ml.id = sub.log_id;
