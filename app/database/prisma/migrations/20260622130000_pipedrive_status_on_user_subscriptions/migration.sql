-- Persist the send_to_pipedrive flag and the webhook send status on the
-- consolidated user_subscriptions row.

-- CreateEnum
CREATE TYPE "ATZ_SED"."PipedriveStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "ATZ_SED"."user_subscriptions"
  ADD COLUMN "send_to_pipedrive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pipedrive_status" "ATZ_SED"."PipedriveStatus";
