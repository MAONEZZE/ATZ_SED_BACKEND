import { IsString, MinLength } from 'class-validator';

export class GenerateEmailStyleDto {
  @IsString()
  @MinLength(10)
  content!: string;
}

export class LandingChatDto {
  @IsString()
  @MinLength(1)
  message!: string;

  landing: unknown;
}
