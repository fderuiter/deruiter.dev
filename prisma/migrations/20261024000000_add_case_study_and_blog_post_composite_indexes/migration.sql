-- CreateIndex
CREATE INDEX "CaseStudy_published_created_at_idx" ON "CaseStudy"("published", "created_at");

-- CreateIndex
CREATE INDEX "CaseStudyFeedback_caseStudySlug_createdAt_idx" ON "CaseStudyFeedback"("caseStudySlug", "createdAt");

-- CreateIndex
CREATE INDEX "CaseStudyFeedback_caseStudySlug_connectionHash_createdAt_idx" ON "CaseStudyFeedback"("caseStudySlug", "connectionHash", "createdAt");

-- CreateIndex
CREATE INDEX "BlogPost_published_created_at_idx" ON "BlogPost"("published", "created_at");

-- CreateIndex
CREATE INDEX "BlogPost_published_updated_at_idx" ON "BlogPost"("published", "updated_at");
