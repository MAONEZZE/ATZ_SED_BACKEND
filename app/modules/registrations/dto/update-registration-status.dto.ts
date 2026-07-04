import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FunnelStatus } from '@modules/registrations/entities/registration.entity';

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    enum: ['pending', 'approved', 'rejected'],
    example: 'approved',
  })
  @IsIn(['pending', 'approved', 'rejected'])
  status!: FunnelStatus;
}
