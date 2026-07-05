-- Recurrence rule for the calendar invite (.ics). The template token
-- {{invite_recorrente}} makes the dispatcher attach a repeating event built
-- from these columns (freq/interval/until). All nullable = single-event invite.

-- AlterTable
ALTER TABLE "ATZ_SED"."events"
  ADD COLUMN "recurrence_freq" TEXT,
  ADD COLUMN "recurrence_interval" INTEGER,
  ADD COLUMN "recurrence_until" TIMESTAMP(3);
