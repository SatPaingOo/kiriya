import type { KiriyaModule } from "../../core/domain/module.js";
import { FetchRepositories } from "./application/fetch-repositories.use-case.js";
import { PullRepositories } from "./application/pull-repositories.use-case.js";
import { ShowStatus } from "./application/show-status.use-case.js";
import { SwitchBranch } from "./application/switch-branch.use-case.js";
import { fetchView, pullView, statusView, switchView } from "./presentation/git.views.js";

export const gitModule: KiriyaModule = {
  id: "git",
  summary: "git.summary",
  about: "git.about",
  examples: [
    "kiriya git status ~/code",
    "kiriya git fetch ~/code",
    "kiriya git pull ~/code",
    "kiriya git switch main ~/code",
  ],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/git.md",
  register(registrar, ports) {
    const { fileSystem, processRunner } = ports;
    registrar.add(new ShowStatus(fileSystem, processRunner), statusView);
    registrar.add(new FetchRepositories(fileSystem, processRunner), fetchView);
    registrar.add(new PullRepositories(fileSystem, processRunner), pullView);
    registrar.add(new SwitchBranch(fileSystem, processRunner), switchView);
  },
};
