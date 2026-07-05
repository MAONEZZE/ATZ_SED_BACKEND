import { EventEntity } from '@modules/events/entities/event.entity';

const makeEvent = (status: any) => new EventEntity('id', 'owner', 'Title', 'slug', status);

describe('EventEntity', () => {
  describe('canTransitionTo', () => {
    it('draft → published: allowed', () => {
      expect(makeEvent('draft').canTransitionTo('published')).toBe(true);
    });
    it('draft → cancelled: allowed', () => {
      expect(makeEvent('draft').canTransitionTo('cancelled')).toBe(true);
    });
    it('draft → ended: NOT allowed', () => {
      expect(makeEvent('draft').canTransitionTo('ended')).toBe(false);
    });
    it('published → ended: allowed', () => {
      expect(makeEvent('published').canTransitionTo('ended')).toBe(true);
    });
    it('cancelled → published: NOT allowed', () => {
      expect(makeEvent('cancelled').canTransitionTo('published')).toBe(false);
    });
  });

  describe('isEditable', () => {
    it('draft is editable', () => expect(makeEvent('draft').isEditable()).toBe(true));
    it('published is editable', () => expect(makeEvent('published').isEditable()).toBe(true));
    it('cancelled is NOT editable', () => expect(makeEvent('cancelled').isEditable()).toBe(false));
    it('ended is NOT editable', () => expect(makeEvent('ended').isEditable()).toBe(false));
  });

  describe('generateSlug', () => {
    it('normalizes accented chars', () => {
      const slug = EventEntity.generateSlug('Ótimo Evento', 'ABC123');
      expect(slug).toBe('otimo-evento-ABC123');
    });
    it('converts spaces to dashes', () => {
      const slug = EventEntity.generateSlug('Tech Day 2026', 'XYZ');
      expect(slug).toBe('tech-day-2026-XYZ');
    });
    it('removes special chars', () => {
      const slug = EventEntity.generateSlug('Evento! (Incrível)', 'AAA');
      expect(slug).toBe('evento-incrivel-AAA');
    });
  });
});
