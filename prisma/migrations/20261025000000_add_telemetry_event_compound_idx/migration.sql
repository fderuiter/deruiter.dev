-- CreateIndex
CREATE INDEX "TelemetryEvent_eventType_projectSlug_idx" ON "TelemetryEvent"("eventType", "projectSlug");
