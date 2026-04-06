import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerSubmissionDto {
  @IsUUID()
  questionId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  selectedAnswerIds: string[];
}

export class CreateResultDto {
  @IsUUID()
  testId: string;

  /** Required when submitting a private test (not creator/admin). */
  @IsOptional()
  @IsString()
  shareToken?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerSubmissionDto)
  answers: AnswerSubmissionDto[];

  @IsInt()
  @Min(0)
  completionTimeSeconds: number;

  @IsInt()
  @Min(0)
  tabSwitchCount: number;

  @IsBoolean()
  finishedByAntiCheat: boolean;
}
