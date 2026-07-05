-- Three forms (add nps), new automation triggers (on_post_event, on_nps),
-- and the user_subscriptions consolidation table.

-- AddEnumValue: FormFieldKind += nps
ALTER TYPE "ATZ_SED"."FormFieldKind" ADD VALUE IF NOT EXISTS 'nps';

-- AddEnumValue: AutomationTrigger += on_post_event, on_nps
ALTER TYPE "ATZ_SED"."AutomationTrigger" ADD VALUE IF NOT EXISTS 'on_post_event';
ALTER TYPE "ATZ_SED"."AutomationTrigger" ADD VALUE IF NOT EXISTS 'on_nps';

-- CreateTable
CREATE TABLE "ATZ_SED"."user_subscriptions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "registration_answers" JSONB,
    "post_event_answers" JSONB,
    "nps_answers" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_subscriptions_event_id_idx" ON "ATZ_SED"."user_subscriptions"("event_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_event_id_email_idx" ON "ATZ_SED"."user_subscriptions"("event_id", "email");

-- CreateIndex
CREATE INDEX "user_subscriptions_event_id_phone_idx" ON "ATZ_SED"."user_subscriptions"("event_id", "phone");

-- AddForeignKey
ALTER TABLE "ATZ_SED"."user_subscriptions" ADD CONSTRAINT "user_subscriptions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "ATZ_SED"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
