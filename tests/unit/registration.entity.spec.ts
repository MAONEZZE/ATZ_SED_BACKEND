import {
  RegistrationEntity,
  FUNNEL_STATUSES,
  FunnelStatus,
} from '@domain/registrations/entities/registration.entity';

const make = (status: FunnelStatus) =>
  new RegistrationEntity(
    'id',
    'ev',
    status,
    {},
    'Nome',
    'a@b.com',
    '11999',
    new Date(),
    new Date(),
  );

describe('RegistrationEntity.canTransitionTo', () => {
  it('has exactly 3 statuses', () =>
    expect(FUNNEL_STATUSES).toEqual(['pending', 'approved', 'rejected']));

  it('allows every transition between the 3 statuses (incl. going back)', () => {
    for (const from of FUNNEL_STATUSES) {
      for (const to of FUNNEL_STATUSES) {
        expect(make(from).canTransitionTo(to)).toBe(true);
      }
    }
  });

  it('rejects an unknown status', () =>
    expect(make('pending').canTransitionTo('screening' as FunnelStatus)).toBe(
      false,
    ));
});
