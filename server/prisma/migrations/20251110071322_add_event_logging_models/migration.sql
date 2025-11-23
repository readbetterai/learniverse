-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "InteractionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementPattern" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "positions" JSONB NOT NULL,
    "zones" JSONB NOT NULL,
    "totalDistance" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovementPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionMetrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL,
    "logoutTime" TIMESTAMP(3),
    "totalDuration" INTEGER,
    "npcInteractionCount" INTEGER NOT NULL DEFAULT 0,
    "npcTotalDuration" INTEGER NOT NULL DEFAULT 0,
    "npcMessageCount" INTEGER NOT NULL DEFAULT 0,
    "proximityEventCount" INTEGER NOT NULL DEFAULT 0,
    "distanceTraveled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "zonesVisited" JSONB,

    CONSTRAINT "SessionMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserEvent_userId_timestamp_idx" ON "UserEvent"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "UserEvent_eventType_timestamp_idx" ON "UserEvent"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "UserEvent_sessionId_idx" ON "UserEvent"("sessionId");

-- CreateIndex
CREATE INDEX "InteractionSession_userId_startTime_idx" ON "InteractionSession"("userId", "startTime");

-- CreateIndex
CREATE INDEX "InteractionSession_targetType_idx" ON "InteractionSession"("targetType");

-- CreateIndex
CREATE INDEX "InteractionSession_sessionId_idx" ON "InteractionSession"("sessionId");

-- CreateIndex
CREATE INDEX "MovementPattern_userId_recordedAt_idx" ON "MovementPattern"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "MovementPattern_sessionId_idx" ON "MovementPattern"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMetrics_sessionId_key" ON "SessionMetrics"("sessionId");

-- CreateIndex
CREATE INDEX "SessionMetrics_userId_loginTime_idx" ON "SessionMetrics"("userId", "loginTime");

-- CreateIndex
CREATE INDEX "SessionMetrics_sessionId_idx" ON "SessionMetrics"("sessionId");

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionSession" ADD CONSTRAINT "InteractionSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementPattern" ADD CONSTRAINT "MovementPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMetrics" ADD CONSTRAINT "SessionMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
