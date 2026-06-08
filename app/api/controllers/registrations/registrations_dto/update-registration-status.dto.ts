import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FunnelStatus } from '@domain/registrations/entities/registration.entity';

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    enum: ['pending', 'screening', 'qualification', 'approved', 'rejected', 'waitlist'],
    example: 'approved',
  })
  @IsEnum(['pending', 'screening', 'qualification', 'approved', 'rejected', 'waitlist'])
  status!: FunnelStatus;
}
