import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ResultsService } from './results.service';
import { CreateResultDto } from './dto/create-result.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('results')
export class ResultsController {
  constructor(private results: ResultsService) {}

  @Post()
  submit(@CurrentUser() user: JwtPayload, @Body() dto: CreateResultDto) {
    return this.results.submit(user.sub, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('mine') mine?: string,
    @Query('testId') testId?: string,
  ) {
    return this.results.findAll(user.sub, { mine, testId });
  }
}
