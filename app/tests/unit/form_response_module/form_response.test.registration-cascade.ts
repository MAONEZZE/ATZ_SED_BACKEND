import * as fs from 'fs';
import * as path from 'path';

// Apagar um inscrito precisa levar junto as respostas dele: sem o Cascade na FK
// as linhas ficam órfãs e continuam aparecendo na listagem de respostas do
// evento (e no CSV) apontando pra um inscrito que não existe mais. É regra de
// banco, não de código — nada no service falha se a FK for afrouxada, então o
// teste olha direto pra fonte.
describe('FormResponse.registration — FK em cascata', () => {
  function schemaSource(): string {
    return fs.readFileSync(path.join(__dirname, '../../../infra/prisma/schema.prisma'), 'utf8');
  }

  it('deleta as respostas junto com o inscrito (onDelete: Cascade no schema)', () => {
    const model = /model FormResponse \{([\s\S]*?)\n\}/.exec(schemaSource());
    if (!model) throw new Error('model FormResponse não encontrado em schema.prisma');

    const relation = /registration\s+Registration\?\s+@relation\(([^)]*)\)/.exec(model[1]);
    if (!relation) throw new Error('relação registration não encontrada em FormResponse');
    expect(relation[1]).toContain('onDelete: Cascade');
  });

  it('mantém a mesma regra na migration que criou a FK', () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        '../../../infra/prisma/migrations/20260817160000_forms_crud_and_form_responses/migration.sql',
      ),
      'utf8',
    );
    const constraint = /ADD CONSTRAINT "form_responses_registration_id_fkey"[\s\S]*?;/.exec(
      migration,
    );
    if (!constraint) throw new Error('FK form_responses_registration_id_fkey não encontrada');
    expect(constraint[0]).toContain('ON DELETE CASCADE');
  });
});
