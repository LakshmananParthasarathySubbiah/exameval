-- CreateTable
CREATE TABLE "QuestionResult" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "questionNumber" TEXT NOT NULL,
    "questionText" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "injectionFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionResult_evaluationId_idx" ON "QuestionResult"("evaluationId");

-- CreateIndex
CREATE INDEX "QuestionResult_questionNumber_idx" ON "QuestionResult"("questionNumber");

-- CreateIndex
CREATE INDEX "AuditLog_evaluationId_idx" ON "AuditLog"("evaluationId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Evaluation_scriptId_idx" ON "Evaluation"("scriptId");

-- CreateIndex
CREATE INDEX "Evaluation_status_idx" ON "Evaluation"("status");

-- CreateIndex
CREATE INDEX "Exam_courseId_idx" ON "Exam"("courseId");

-- CreateIndex
CREATE INDEX "Script_examId_idx" ON "Script"("examId");

-- CreateIndex
CREATE INDEX "Script_studentId_idx" ON "Script"("studentId");

-- CreateIndex
CREATE INDEX "Script_status_idx" ON "Script"("status");

-- CreateIndex
CREATE INDEX "Student_examId_idx" ON "Student"("examId");

-- AddForeignKey
ALTER TABLE "QuestionResult" ADD CONSTRAINT "QuestionResult_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
