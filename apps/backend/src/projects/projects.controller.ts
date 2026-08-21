import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ProjectsListQueryDto } from "./dto/projects-list-query.dto";
import { UpdateProjectStageDto } from "./dto/update-stage.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@RequirePermission("projects:read")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Query() query: ProjectsListQueryDto) {
    return this.projectsService.findAll(query);
  }

  @Get("kanban")
  getKanban() {
    return this.projectsService.getKanban();
  }

  @Get("kpis")
  getKpis() {
    return this.projectsService.getKpis();
  }

  @Get("stage-distribution")
  getStageDistribution() {
    return this.projectsService.getStageDistribution();
  }

  @Get("stuck")
  getStuckProjects() {
    return this.projectsService.getStuckProjects();
  }

  @Get("closing-soon")
  getClosingSoon() {
    return this.projectsService.getClosingSoon();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(":id/stage")
  @RequirePermission("projects:write")
  updateStage(@Param("id") id: string, @Body() dto: UpdateProjectStageDto) {
    return this.projectsService.updateStage(id, dto);
  }
}
