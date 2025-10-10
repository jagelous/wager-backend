/*
  Warnings:

  - A unique constraint covering the columns `[solanaPublicKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `solanaPublicKey` VARCHAR(191) NULL,
    MODIFY `email` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_solanaPublicKey_key` ON `User`(`solanaPublicKey`);
