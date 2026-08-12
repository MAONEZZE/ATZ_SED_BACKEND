import { EntityBase } from '@domain/shared/entity.base';
import { EventEntity } from '@domain/event_module/event.entity';
import { RegistrationEntity } from '@domain/registration_module/registration.entity';

class Foo extends EntityBase {
  constructor(id: string) {
    super(id);
  }
}

class Bar extends EntityBase {
  constructor(id: string) {
    super(id);
  }
}

describe('EntityBase.equals', () => {
  it('treats two instances loaded separately as the same entity', () => {
    expect(new Foo('id-1').equals(new Foo('id-1'))).toBe(true);
  });

  it('separates entities with different ids', () => {
    expect(new Foo('id-1').equals(new Foo('id-2'))).toBe(false);
  });

  // Sem a checagem de construtor, um uuid coincidente faria entidades de tipos
  // diferentes se considerarem a mesma.
  it('separates different entity types that happen to share an id', () => {
    expect(new Foo('same-id').equals(new Bar('same-id'))).toBe(false);
  });

  it('is false for null and undefined', () => {
    const foo = new Foo('id-1');
    expect(foo.equals(null)).toBe(false);
    expect(foo.equals(undefined)).toBe(false);
    expect(foo.equals()).toBe(false);
  });

  it('is true for the same reference', () => {
    const foo = new Foo('id-1');
    expect(foo.equals(foo)).toBe(true);
  });
});

describe('entities that already existed', () => {
  it('keeps EventEntity behaviour after moving id to the base', () => {
    const event = new EventEntity('evt-1', 'owner-1', 'Título', 'titulo', 'published');

    expect(event.id).toBe('evt-1');
    expect(event.isEditable()).toBe(true);
    expect(event.canTransitionTo('ended')).toBe(true);
    expect(event.equals(new EventEntity('evt-1', 'outro-dono', 'Outro', 'outro', 'draft'))).toBe(
      true,
    );
  });

  it('keeps RegistrationEntity behaviour after moving id to the base', () => {
    const registration = new RegistrationEntity(
      'reg-1',
      'evt-1',
      'pending',
      {},
      'Nome',
      'a@b.test',
      '5511999999999',
      new Date(),
      new Date(),
    );

    expect(registration.id).toBe('reg-1');
    expect(registration.canTransitionTo('approved')).toBe(true);
  });
});
