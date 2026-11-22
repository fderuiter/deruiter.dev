-- Idempotency key for feedback replayed by the offline queue (#3807, slice 3).
-- Additive and nullable: existing rows keep NULL, and PostgreSQL treats NULLs
-- as distinct, so the unique index accepts them.

-- AlterTable
ALTER TABLE "CaseStudyFeedback" ADD COLUMN     "operationKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudyFeedback_connectionHash_operationKey_key" ON "CaseStudyFeedback"("connectionHash", "operationKey");
