import { Module } from "@nestjs/common";
import { CompanyProfilesController } from "./company-profiles.controller";
import { CompanyProfilesService } from "./company-profiles.service";

@Module({
  controllers: [CompanyProfilesController],
  providers: [CompanyProfilesService],
  exports: [CompanyProfilesService],
})
export class CompanyProfilesModule {}
