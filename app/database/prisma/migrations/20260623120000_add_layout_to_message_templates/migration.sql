-- Layout HTML/visual dos templates de e-mail. WhatsApp manda ambos null.
-- layout_config = blob opaco (JSONB), nao validado internamente.
-- Aplicado manualmente via `db execute` por drift no historico (evitar migrate reset).
ALTER TABLE "ATZ_SED"."message_templates"
  ADD COLUMN "layout_config" JSONB,
  ADD COLUMN "style_key" TEXT;
