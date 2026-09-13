import type { KiriyaModule } from "../../core/domain/module.js";
import { OpenTarget } from "./application/open-target.use-case.js";
import { openView } from "./presentation/open.view.js";

export const openModule: KiriyaModule = {
  id: "open",
  summary: "open.summary",
  register(registrar, ports) {
    registrar.add(new OpenTarget(ports.opener, ports.fileSystem, ports.environment), openView);
  },
};
