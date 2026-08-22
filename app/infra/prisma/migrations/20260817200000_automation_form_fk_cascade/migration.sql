-- A FK `automation_rules.form_id` nasceu (migration 20260817160000) com
-- ON DELETE SET NULL. Isso está errado desde que o `form_id` virou escopo de
-- regra: apagar um formulário não apagava as regras dele, zerava o vínculo. Nos
-- dois gatilhos que guardam formulário o resultado é ruim:
--
--   * `on_form_submitted` com form_id NULL nunca mais dispara (o engine filtra
--     por formulário), mas segue ativa na listagem — automação zumbi;
--   * `on_registration` com form_id NULL passa a valer para QUALQUER origem, ou
--     seja, apagar um formulário AUMENTA o alcance da automação.
--
-- Regra escopada a um formulário deve morrer com ele: CASCADE.

ALTER TABLE "SED"."automation_rules"
  DROP CONSTRAINT IF EXISTS "automation_rules_form_id_fkey",
  ADD CONSTRAINT "automation_rules_form_id_fkey" FOREIGN KEY ("form_id")
    REFERENCES "SED"."forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
