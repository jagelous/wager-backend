-- CreateTable
CREATE TABLE `Transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `walletId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `vsAmount` DOUBLE NOT NULL,
    `solPrice` DOUBLE NULL,
    `usdValue` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `transactionHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `Wallet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
