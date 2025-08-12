/*
  Warnings:

  - A unique constraint covering the columns `[user_id,full_path]` on the table `directories` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "directories_user_id_full_path_key" ON "public"."directories"("user_id", "full_path");
