import type { KiriyaModule } from "../../core/domain/module.js";
import { CleanEngine } from "./application/clean-engine.use-case.js";
import { ListContainers } from "./application/list-containers.use-case.js";
import { createRebuild, createUp } from "./application/run-compose.use-case.js";
import { ShowLogs } from "./application/show-logs.use-case.js";
import { StopProject } from "./application/stop-project.use-case.js";
import { cleanView, downView, logsView, psView, rebuildView, upView } from "./presentation/docker.views.js";

export const dockerModule: KiriyaModule = {
  id: "docker",
  summary: "docker.summary",
  register(registrar, ports) {
    const { fileSystem, fileContent, processRunner } = ports;
    registrar.add(new ListContainers(fileSystem, fileContent, processRunner), psView);
    registrar.add(createUp(fileSystem, fileContent, processRunner), upView);
    registrar.add(new StopProject(fileSystem, fileContent, processRunner), downView);
    registrar.add(new ShowLogs(fileSystem, fileContent, processRunner), logsView);
    registrar.add(createRebuild(fileSystem, fileContent, processRunner), rebuildView);
    registrar.add(new CleanEngine(processRunner), cleanView);
  },
};
