-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Script" ADD COLUMN     "ocrMethod" TEXT;

-- CreateIndex
CREATE INDEX "Exam_createdById_idx" ON "Exam"("createdById");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
