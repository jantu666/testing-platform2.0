import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsBoolean()
  isPrivate: boolean;

  /** Hint for UI; questions added in editor */
  @IsOptional()
  @IsInt()
  @Min(0)
  questionCount?: number;
}
