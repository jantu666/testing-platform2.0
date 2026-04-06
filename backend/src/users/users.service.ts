import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      blocked: user.blocked,
      roles: user.roles.map((r) => r.role.name),
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, avatarUrl?: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
      include: { roles: { include: { role: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      roles: user.roles.map((r) => r.role.name),
    };
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        _count: { select: { results: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      roles: user.roles.map((r) => r.role.name),
      testsPassed: user._count.results,
    };
  }

  async userHasRole(userId: string, role: RoleName): Promise<boolean> {
    const row = await this.prisma.userRole.findFirst({
      where: { userId, role: { name: role } },
    });
    return !!row;
  }

  async getRoleNames(userId: string): Promise<Set<RoleName>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) return new Set();
    return new Set(user.roles.map((r) => r.role.name));
  }
}
