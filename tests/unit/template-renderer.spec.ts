import { TemplateRenderer } from '@services/automations/template-renderer.service';

describe('TemplateRenderer', () => {
  const renderer = new TemplateRenderer();

  describe('render', () => {
    it('replaces {{ nome }} with value', () => {
      expect(renderer.render('Olá {{ nome }}!', { nome: 'João' })).toBe('Olá João!');
    });

    it('is case-insensitive on variable keys', () => {
      expect(renderer.render('{{ NOME }}', { nome: 'Ana' })).toBe('Ana');
    });

    it('replaces multiple different variables', () => {
      expect(
        renderer.render('{{nome}} foi para {{evento}}', { nome: 'Maria', evento: 'Tech Day' }),
      ).toBe('Maria foi para Tech Day');
    });

    it('leaves empty string for unknown variable', () => {
      expect(renderer.render('{{desconhecido}}', {})).toBe('');
    });

    it('handles whitespace around variable name', () => {
      expect(renderer.render('{{ email }}', { email: 'a@b.com' })).toBe('a@b.com');
    });

    it('replaces same variable multiple times', () => {
      expect(renderer.render('{{nome}} e {{nome}}', { nome: 'Carlos' })).toBe('Carlos e Carlos');
    });
  });

  describe('buildVariables', () => {
    const reg = { name: 'João', email: 'joao@test.com', phone: '11999' };
    const event = {
      title: 'Tech Day',
      eventDate: new Date('2026-06-15T18:00:00'),
      location: 'SP',
      capacity: 100,
      dressCode: 'Smart',
      groupLink: 'https://wa.me/group',
    };

    it('maps nome and name', () => {
      const vars = renderer.buildVariables({ registration: reg, event });
      expect(vars['nome']).toBe('João');
      expect(vars['name']).toBe('João');
    });

    it('maps evento and event', () => {
      const vars = renderer.buildVariables({ registration: reg, event });
      expect(vars['evento']).toBe('Tech Day');
    });

    it('maps data as formatted string', () => {
      const vars = renderer.buildVariables({ registration: reg, event });
      expect(vars['data']).toMatch(/15\/06\/2026/);
    });

    it('maps empty string when eventDate is null', () => {
      const vars = renderer.buildVariables({
        registration: reg,
        event: { ...event, eventDate: null },
      });
      expect(vars['data']).toBe('');
    });

    it('merges extra variables', () => {
      const vars = renderer.buildVariables({ registration: reg, event, extra: { invite: 'VIP' } });
      expect(vars['invite']).toBe('VIP');
    });
  });
});
