-- View recent events with usernames
SELECT
    u.username,
    e."eventType",
    e."eventCategory",
    e.metadata,
    e.timestamp
FROM "UserEvent" e
JOIN "User" u ON e."userId" = u.id
ORDER BY e.timestamp DESC
LIMIT 20;

-- Event type distribution
SELECT
    "eventType",
    COUNT(*) as count
FROM "UserEvent"
GROUP BY "eventType"
ORDER BY count DESC;

-- Session metrics summary
SELECT
    u.username,
    s."loginTime",
    s."logoutTime",
    s."totalDuration" as duration_seconds,
    s."npcInteractionCount",
    s."npcMessageCount"
FROM "SessionMetrics" s
JOIN "User" u ON s."userId" = u.id
ORDER BY s."loginTime" DESC;

-- NPC interaction details
SELECT
    u.username,
    i."targetId" as npc,
    i."startTime",
    i."endTime",
    i.duration / 1000.0 as duration_seconds
FROM "InteractionSession" i
JOIN "User" u ON i."userId" = u.id
WHERE i."targetType" = 'NPC'
ORDER BY i."startTime" DESC;

-- Zone visit patterns
SELECT
    e."userId",
    u.username,
    (e.metadata->>'zone')::text as zone,
    COUNT(*) as visit_count
FROM "UserEvent" e
JOIN "User" u ON e."userId" = u.id
WHERE e."eventType" = 'ZONE_ENTER'
GROUP BY e."userId", u.username, zone
ORDER BY u.username, visit_count DESC;