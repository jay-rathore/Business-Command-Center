import { Module } from "@nestjs/common";
import { DealersModule } from "../dealers/dealers.module";
import { ProjectsModule } from "../projects/projects.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [DealersModule, ProjectsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
