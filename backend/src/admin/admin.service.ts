import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { roles: { include: { role: true } } },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      blocked: u.blocked,
      createdAt: u.createdAt,
      roles: u.roles.map((r) => r.role.name),
    }));
  }

  async updateUser(actorId: string, targetId: string, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('User not found');
    const targetIsAdmin = target.roles.some((r) => r.role.name === RoleName.ADMIN);
    if (targetIsAdmin && targetId !== actorId) {
      // Admins cannot block/unblock other admins via this endpoint (protect admin accounts)
      if (dto.blocked !== undefined) {
        throw new ForbiddenException('Cannot change block status of another administrator');
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        ...(dto.blocked !== undefined ? { blocked: dto.blocked } : {}),
      },
      include: { roles: { include: { role: true } } },
    });
    return {
      id: updated.id,
      email: updated.email,
      nickname: updated.nickname,
      blocked: updated.blocked,
      roles: updated.roles.map((r) => r.role.name),
    };
  }

  async assignRole(_actorId: string, targetId: string, role: RoleName) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    const roleRow = await this.prisma.role.findUnique({ where: { name: role } });
    if (!roleRow) throw new BadRequestException('Unknown role');

    const existing = await this.prisma.userRole.findFirst({
      where: { userId: targetId, roleId: roleRow.id },
    });
    if (!existing) {
      await this.prisma.userRole.create({
        data: { userId: targetId, roleId: roleRow.id },
      });
    }
    return { ok: true };
  }

  async removeRole(_actorId: string, targetId: string, role: RoleName) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('User not found');

    const targetHasAdmin = target.roles.some((r) => r.role.name === RoleName.ADMIN);
    if (role === RoleName.ADMIN && targetHasAdmin) {
      throw new ForbiddenException('Cannot remove ADMIN role from an administrator');
    }

    const roleRow = await this.prisma.role.findUnique({ where: { name: role } });
    if (!roleRow) throw new BadRequestException('Unknown role');

    await this.prisma.userRole.deleteMany({
      where: { userId: targetId, roleId: roleRow.id },
    });
    return { ok: true };
  }
}
