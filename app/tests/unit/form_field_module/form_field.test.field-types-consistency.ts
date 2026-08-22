import * as fs from 'fs';
import * as path from 'path';
import { FIELD_TYPES } from '@domain/form_field_module/form-field.entity';

// FIELD_TYPES é duplicado em três lugares que não se importam entre si
// (schema.prisma, a entidade de domínio, o DTO da API). `FormFieldService.create`
// faz `input.type as FieldType` — cast cego — então esquecer uma lista aqui
// falha longe da causa: um tipo aceito pelo DTO mas ausente do enum do banco
// quebra só na escrita, com um erro do Prisma difícil de recuar até aqui.
describe('FieldType — as três listas ficam em sincronia', () => {
  function extractDtoTypes(): string[] {
    const dtoPath = path.join(__dirname, '../../../api/dto/form_field_module/form-field.dto.ts');
    const src = fs.readFileSync(dtoPath, 'utf8');
    const match = /const FORM_FIELD_TYPES = \[([\s\S]*?)\] as const;/.exec(src);
    if (!match) throw new Error('FORM_FIELD_TYPES não encontrado em form-field.dto.ts');
    return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  }

  function extractSchemaTypes(): string[] {
    const schemaPath = path.join(__dirname, '../../../infra/prisma/schema.prisma');
    const src = fs.readFileSync(schemaPath, 'utf8');
    const match = /enum FieldType \{([\s\S]*?)\}/.exec(src);
    if (!match) throw new Error('enum FieldType não encontrado em schema.prisma');
    return match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('///') && !line.startsWith('@@'));
  }

  it('domain FIELD_TYPES, DTO FORM_FIELD_TYPES e schema.prisma FieldType têm os mesmos valores', () => {
    const dtoTypes = extractDtoTypes();
    const schemaTypes = extractSchemaTypes();

    expect([...dtoTypes].sort()).toEqual([...FIELD_TYPES].sort());
    expect([...schemaTypes].sort()).toEqual([...FIELD_TYPES].sort());
  });
});
