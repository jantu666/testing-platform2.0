import { IsEnum } from 'class-validator';
import { RoleName } from '@prisma/client';

export class AssignRoleDto {
  @IsEnum(RoleName)
  role: RoleName;
}
