import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';

@Injectable()
export class TestsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async create(creatorId: string, dto: CreateTestDto) {
    return this.prisma.test.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        isPrivate: dto.isPrivate,
        creatorId,
        published: false,
      },
      include: { questions: { include: { answers: true }, orderBy: { order: 'asc' } } },
    });
  }

  async findAll(userId: string | undefined, shareToken?: string) {
    const roles = userId ? await this.usersService.getRoleNames(userId) : new Set<RoleName>();
    const isAdmin = roles.has(RoleName.ADMIN);

    const tests = await this.prisma.test.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: { select: { id: true, nickname: true } },
        questions: { select: { id: true } },
      },
    });

    return tests
      .filter((t) => this.canSeeTestInList(t, userId, isAdmin, shareToken))
      .map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        isPrivate: t.isPrivate,
        published: t.published,
        creatorId: t.creatorId,
        creator: t.creator,
        questionCount: t.questions.length,
        shareToken: isAdmin || t.creatorId === userId ? t.shareToken : undefined,
      }));
  }

  private canSeeTestInList(
    t: { published: boolean; isPrivate: boolean; creatorId: string; shareToken: string | null },
    userId: string | undefined,
    isAdmin: boolean,
    shareToken?: string,
  ): boolean {
    if (!t.published) {
      if (!userId) return false;
      if (isAdmin || t.creatorId === userId) return true;
      return false;
    }
    if (!t.isPrivate) return true;
    if (!userId) return !!(shareToken && t.shareToken === shareToken);
    if (isAdmin || t.creatorId === userId) return true;
    return !!(shareToken && t.shareToken === shareToken);
  }

  async findOne(
    id: string,
    userId: string | undefined,
    shareToken?: string,
  ) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, nickname: true } },
        questions: { include: { answers: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!test) throw new NotFoundException('Test not found');

    const roles = userId ? await this.usersService.getRoleNames(userId) : new Set<RoleName>();
    const isAdmin = roles.has(RoleName.ADMIN);
    const isCreator = userId === test.creatorId;

    if (!this.canViewTestDetail(test, userId, isAdmin, isCreator, shareToken)) {
      throw new NotFoundException('Test not found');
    }

    const canEdit = !!(userId && (isCreator || isAdmin));
    const stripCorrect = !canEdit;

    return this.serializeTest(test, stripCorrect, canEdit);
  }

  private canViewTestDetail(
    test: { published: boolean; isPrivate: boolean; creatorId: string; shareToken: string | null },
    userId: string | undefined,
    isAdmin: boolean,
    isCreator: boolean,
    shareToken?: string,
  ): boolean {
    if (!test.published) {
      if (!userId) return false;
      return isAdmin || isCreator;
    }
    if (!test.isPrivate) return true;
    if (isAdmin || isCreator) return true;
    if (shareToken && test.shareToken === shareToken) return true;
    return false;
  }

  private serializeTest(
    test: {
      id: string;
      title: string;
      description: string;
      isPrivate: boolean;
      published: boolean;
      shareToken: string | null;
      creatorId: string;
      creator: { id: string; nickname: string };
      questions: {
        id: string;
        order: number;
        text: string;
        answers: { id: string; text: string; isCorrect: boolean }[];
      }[];
    },
    stripCorrect: boolean,
    includeShare: boolean,
  ) {
    return {
      id: test.id,
      title: test.title,
      description: test.description,
      isPrivate: test.isPrivate,
      published: test.published,
      shareToken: includeShare ? test.shareToken : undefined,
      creatorId: test.creatorId,
      creator: test.creator,
      questions: test.questions.map((q) => ({
        id: q.id,
        order: q.order,
        text: q.text,
        answers: q.answers.map((a) => ({
          id: a.id,
          text: a.text,
          ...(stripCorrect ? {} : { isCorrect: a.isCorrect }),
        })),
      })),
    };
  }

  async update(testId: string, userId: string, dto: UpdateTestDto) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');

    const roles = await this.usersService.getRoleNames(userId);
    const isAdmin = roles.has(RoleName.ADMIN);
    if (test.creatorId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only edit your own tests');
    }

    if (dto.published === true && dto.questions?.length) {
      for (const q of dto.questions) {
        const correct = q.answers.filter((a) => a.isCorrect);
        if (correct.length < 1) {
          throw new BadRequestException(`Question "${q.text.slice(0, 40)}..." needs at least one correct answer`);
        }
      }
    }

    let shareToken = test.shareToken;
    const willPublish = dto.published === true || (dto.published === undefined && test.published);
    const willPrivate = dto.isPrivate === true || (dto.isPrivate === undefined && test.isPrivate);

    if (dto.published === true && !test.published) {
      if (willPrivate && !shareToken) {
        shareToken = randomBytes(24).toString('hex');
      }
    }
    if (dto.isPrivate === false) {
      shareToken = null;
    }
    if (dto.isPrivate === true && willPublish && !shareToken) {
      shareToken = randomBytes(24).toString('hex');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id: testId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.isPrivate !== undefined ? { isPrivate: dto.isPrivate } : {}),
          ...(dto.published !== undefined ? { published: dto.published } : {}),
          ...(shareToken !== test.shareToken ? { shareToken } : {}),
        },
      });

      if (dto.questions) {
        await tx.answer.deleteMany({
          where: { question: { testId } },
        });
        await tx.question.deleteMany({ where: { testId } });

        for (const q of dto.questions.sort((a, b) => a.order - b.order)) {
          await tx.question.create({
            data: {
              testId,
              order: q.order,
              text: q.text,
              answers: {
                create: q.answers.map((a) => ({
                  text: a.text,
                  isCorrect: a.isCorrect,
                })),
              },
            },
          });
        }
      }
    });

    const updated = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        creator: { select: { id: true, nickname: true } },
        questions: { include: { answers: true }, orderBy: { order: 'asc' } },
      },
    });
    return this.serializeTest(updated!, false, true);
  }

  async remove(testId: string, userId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    const roles = await this.usersService.getRoleNames(userId);
    if (test.creatorId !== userId && !roles.has(RoleName.ADMIN)) {
      throw new ForbiddenException('You can only delete your own tests');
    }
    await this.prisma.test.delete({ where: { id: testId } });
    return { deleted: true };
  }
}
