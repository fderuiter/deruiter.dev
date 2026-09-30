-- DropIndex
DROP INDEX "CaseStudyReaction_caseStudySlug_reactionType_connectionHash_key";

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudyReaction_caseStudySlug_connectionHash_reactionType_key" ON "CaseStudyReaction"("caseStudySlug", "connectionHash", "reactionType");
