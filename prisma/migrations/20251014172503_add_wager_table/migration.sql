-- CreateTable
CREATE TABLE `Wager` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `side1` VARCHAR(191) NOT NULL,
    `side2` VARCHAR(191) NOT NULL,
    `wagerEndTime` DATETIME(3) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `winningSide` VARCHAR(191) NULL,
    `wagerStatus` VARCHAR(191) NOT NULL DEFAULT 'active',
    `side1Amount` DOUBLE NOT NULL DEFAULT 0,
    `side2Amount` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Wager` ADD CONSTRAINT `Wager_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
