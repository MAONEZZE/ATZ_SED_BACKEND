import { IsEnum } from 'class-validator';
import { FunnelStatus } from '@domain/registrations/entities/registration.entity';

export class UpdateRegistrationStatusDto {
  @IsEnum(['pending', 'screening', 'qualification', 'approved', 'rejected', 'waitlist'])
  status!: FunnelStatus;
}
