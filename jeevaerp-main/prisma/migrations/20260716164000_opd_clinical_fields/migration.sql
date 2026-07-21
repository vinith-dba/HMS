-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "languages" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "qualification" TEXT;

-- AlterTable
ALTER TABLE "PrescriptionUpload" ADD COLUMN     "advice" TEXT,
ADD COLUMN     "diagnosis" TEXT,
ADD COLUMN     "labsAdvised" TEXT,
ADD COLUMN     "nextVisit" TEXT;
