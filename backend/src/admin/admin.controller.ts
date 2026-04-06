import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AdminService } from './admin.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(RoleName.ADMIN)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.admin.updateUser(user.sub, id, dto);
  }

  @Post('users/:id/roles')
  assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.admin.assignRole(user.sub, id, dto.role);
  }

  @Delete('users/:id/roles/:role')
  removeRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('role', new ParseEnumPipe(RoleName)) role: RoleName,
  ) {
    return this.admin.removeRole(user.sub, id, role);
  }
}
