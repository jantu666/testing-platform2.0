import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { UsersModule } from '../users/users.module';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [UsersModule, ConfigModule, JwtModule.register({})],
  controllers: [TestsController],
  providers: [TestsService, RolesGuard],
  exports: [TestsService],
})
export class TestsModule {}
