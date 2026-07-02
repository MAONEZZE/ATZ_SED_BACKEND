-- Feature de Landing page removida por completo.
-- Apaga as tabelas de landing. As FKs têm ON DELETE CASCADE, mas dropamos
-- na ordem filho -> pai por segurança. CASCADE remove constraints dependentes.
DROP TABLE IF EXISTS "ATZ_SED"."landing_sections" CASCADE;
DROP TABLE IF EXISTS "ATZ_SED"."landing_pages" CASCADE;
