/*
  Warnings:

  - You are about to drop the `import_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "import_logs" DROP CONSTRAINT "import_logs_userId_fkey";

-- DropTable
DROP TABLE "import_logs";
