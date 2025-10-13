-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "googleId" TEXT,
    "solanaPublicKey" TEXT,
    "email" TEXT,
    "name" TEXT,
    "avatar" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLogin" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_solanaPublicKey_key" ON "User"("solanaPublicKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
