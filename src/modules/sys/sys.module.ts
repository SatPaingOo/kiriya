import type { KiriyaModule } from "../../core/domain/module.js";
import { CreateReport } from "./application/create-report.use-case.js";
import { FindTools } from "./application/find-tools.use-case.js";
import { ShowInfo } from "./application/show-info.use-case.js";
import { infoView, reportView, toolsView } from "./presentation/sys.views.js";

export const sysModule: KiriyaModule = {
  id: "sys",
  summary: "sys.summary",
  about: "sys.about",
  examples: ["kiriya sys info", "kiriya sys tools", "kiriya sys report"],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/sys.md",
  register(registrar, ports) {
    registrar.add(new ShowInfo(ports.system, ports.runtime), infoView);
    registrar.add(new FindTools(ports.processRunner), toolsView);
    registrar.add(new CreateReport(ports.system, ports.processRunner, ports.runtime), reportView);
  },
};
