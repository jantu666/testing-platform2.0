import {
  IsArray,
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AnswerInputDto } from './answer-input.dto';

export class QuestionInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsInt()
  @Min(0)
  order: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers: AnswerInputDto[];
}
