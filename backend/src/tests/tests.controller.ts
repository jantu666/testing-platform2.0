import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { RoleName } from '@prisma/client';
import { TestsService } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('tests')
export class TestsController {
  constructor(
    private tests: TestsService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleName.CREATOR, RoleName.ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTestDto) {
    return this.tests.create(user.sub, dto);
  }

  @Public()
  @Get()
  findAll(@Req() req: Request, @Query('shareToken') shareToken?: string) {
    const userId = this.getOptionalUserId(req.headers.authorization);
    return this.tests.findAll(userId, shareToken);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('shareToken') shareToken?: string,
  ) {
    const userId = this.getOptionalUserId(req.headers.authorization);
    return this.tests.findOne(id, userId, shareToken);
  }

  private getOptionalUserId(authHeader?: string): string | undefined {
    if (!authHeader?.startsWith('Bearer ')) return undefined;
    try {
      const payload = this.jwt.verify<JwtPayload>(authHeader.slice(7), {
        secret: this.config.get<string>('JWT_ACCESS_SECRET') || 'dev-access',
      });
      if (payload.type !== 'access') return undefined;
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleName.CREATOR, RoleName.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTestDto,
  ) {
    return this.tests.update(id, user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleName.CREATOR, RoleName.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tests.remove(id, user.sub);
  }
}
