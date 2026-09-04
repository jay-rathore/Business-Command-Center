import { Module } from "@nestjs/common";
import { ArchitectsController } from "./architects.controller";
import { ArchitectsService } from "./architects.service";

@Module({
  controllers: [ArchitectsController],
  providers: [ArchitectsService],
})
export class ArchitectsModule {}
