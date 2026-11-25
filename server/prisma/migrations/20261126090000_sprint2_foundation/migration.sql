-- Sprint 2 foundation (F-08 revisions, F-09 close, F-10 grades). See docs/sprints/sprint-2/change-register.md RISK-01:
-- the unique index on "Submission"."milestoneId" is replaced, so code from before Sprint 2 cannot run on this schema.

ALTER TABLE "Milestone" ADD COLUMN "closedAt" TIMESTAMP(3);

ALTER TABLE "Submission" ADD COLUMN "revisionNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_revisionNo_range" CHECK ("revisionNo" BETWEEN 1 AND 5);
DROP INDEX "Submission_milestoneId_key";
CREATE UNIQUE INDEX "Submission_milestoneId_revisionNo_key" ON "Submission"("milestoneId", "revisionNo");
CREATE INDEX "Submission_milestoneId_idx" ON "Submission"("milestoneId");

CREATE TABLE "Grade" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "supervisorId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Grade_score_range" CHECK ("score" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "Grade_submissionId_key" ON "Grade"("submissionId");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
