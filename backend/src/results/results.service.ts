import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateResultDto } from './dto/create-result.dto';

@Injectable()
export class ResultsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async submit(userId: string, dto: CreateResultDto) {
    const test = await this.prisma.test.findUnique({
      where: { id: dto.testId },
      include: {
        questions: {
          include: { answers: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!test || !test.published) {
      throw new NotFoundException('Test not found or not published');
    }

    const roles = await this.usersService.getRoleNames(userId);
    const isAdmin = roles.has(RoleName.ADMIN);
    const isCreator = test.creatorId === userId;
    if (
      test.isPrivate &&
      !isCreator &&
      !isAdmin &&
      (!dto.shareToken || dto.shareToken !== test.shareToken)
    ) {
      throw new ForbiddenException('Invalid or missing share token for this private test');
    }

    if (dto.answers.length !== test.questions.length) {
      throw new BadRequestException('Answer every question');
    }

    const byQuestion = new Map(
      dto.answers.map((a) => [a.questionId, new Set(a.selectedAnswerIds)]),
    );
    let correctCount = 0;
    for (const q of test.questions) {
      const selected = byQuestion.get(q.id);
      if (!selected) {
        throw new BadRequestException(`Missing answer for question ${q.id}`);
      }
      const correctIds = new Set(q.answers.filter((a) => a.isCorrect).map((a) => a.id));
      const exactMatch =
        correctIds.size === selected.size &&
        [...correctIds].every((id) => selected.has(id));
      if (exactMatch) correctCount++;
    }

    const score =
      test.questions.length === 0
        ? 0
        : Math.round((correctCount / test.questions.length) * 100);

    const finishedByAntiCheat = dto.tabSwitchCount >= 3 || dto.finishedByAntiCheat;

    const result = await this.prisma.result.create({
      data: {
        userId,
        testId: dto.testId,
        score,
        completionTimeSeconds: dto.completionTimeSeconds,
        tabSwitchCount: dto.tabSwitchCount,
        finishedByAntiCheat,
      },
      include: {
        test: { select: { id: true, title: true } },
      },
    });

    return {
      id: result.id,
      score: result.score,
      completionTimeSeconds: result.completionTimeSeconds,
      tabSwitchCount: result.tabSwitchCount,
      finishedByAntiCheat: result.finishedByAntiCheat,
      test: result.test,
      createdAt: result.createdAt,
    };
  }

  async findAll(
    userId: string,
    query: { mine?: string; testId?: string },
  ) {
    const roles = await this.usersService.getRoleNames(userId);
    const isAdmin = roles.has(RoleName.ADMIN);

    if (query.mine === 'true' || query.mine === '1') {
      return this.prisma.result.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          test: { select: { id: true, title: true, isPrivate: true } },
        },
      });
    }

    if (query.testId) {
      const test = await this.prisma.test.findUnique({
        where: { id: query.testId },
      });
      if (!test) throw new NotFoundException('Test not found');
      if (test.creatorId !== userId && !isAdmin) {
        throw new ForbiddenException('You can only view results for your own tests');
      }
      return this.prisma.result.findMany({
        where: { testId: query.testId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      });
    }

    return this.prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        test: { select: { id: true, title: true } },
      },
    });
  }
}
