import { RegistrationEntity } from '@domain/registrations/entities/registration.entity';

const make = (status: any) =>
  new RegistrationEntity('id', 'ev', status, {}, 'Nome', 'a@b.com', '11999', new Date(), new Date());

describe('RegistrationEntity.canTransitionTo', () => {
  it('pending → screening: allowed', () => expect(make('pending').canTransitionTo('screening')).toBe(true));
  it('pending → approved: allowed', () => expect(make('pending').canTransitionTo('approved')).toBe(true));
  it('pending → rejected: allowed', () => expect(make('pending').canTransitionTo('rejected')).toBe(true));
  it('pending → waitlist: allowed', () => expect(make('pending').canTransitionTo('waitlist')).toBe(true));
  it('screening → qualification: allowed', () => expect(make('screening').canTransitionTo('qualification')).toBe(true));
  it('qualification → approved: allowed', () => expect(make('qualification').canTransitionTo('approved')).toBe(true));
  it('qualification → pending: NOT allowed', () => expect(make('qualification').canTransitionTo('pending')).toBe(false));
  it('approved → anywhere: NOT allowed', () => {
    expect(make('approved').canTransitionTo('rejected')).toBe(false);
    expect(make('approved').canTransitionTo('pending')).toBe(false);
    expect(make('approved').canTransitionTo('waitlist')).toBe(false);
  });
  it('rejected → anywhere: NOT allowed', () => {
    expect(make('rejected').canTransitionTo('approved')).toBe(false);
    expect(make('rejected').canTransitionTo('pending')).toBe(false);
  });
  it('waitlist → approved: allowed', () => expect(make('waitlist').canTransitionTo('approved')).toBe(true));
  it('waitlist → rejected: allowed', () => expect(make('waitlist').canTransitionTo('rejected')).toBe(true));
  it('waitlist → pending: NOT allowed', () => expect(make('waitlist').canTransitionTo('pending')).toBe(false));
});
