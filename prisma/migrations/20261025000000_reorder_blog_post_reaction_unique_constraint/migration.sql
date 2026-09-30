-- DropIndex
DROP INDEX "BlogPostReaction_blogPostSlug_reactionType_connectionHash_key";

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostReaction_blogPostSlug_connectionHash_reactionType_key" ON "BlogPostReaction"("blogPostSlug", "connectionHash", "reactionType");
