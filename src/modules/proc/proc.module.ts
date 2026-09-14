import type { KiriyaModule } from "../../core/domain/module.js";
import { EndProcesses } from "./application/end-processes.use-case.js";
import { FindProcesses } from "./application/find-processes.use-case.js";
import { ListProcesses } from "./application/list-processes.use-case.js";
import { ShowTree } from "./application/show-tree.use-case.js";
import { killView, processesView, treeView } from "./presentation/proc.views.js";

export const procModule: KiriyaModule = {
  id: "proc",
  summary: "proc.summary",
  about: "proc.about",
  examples: ["kiriya proc find vite", "kiriya proc tree", "kiriya proc kill node"],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/proc.md",
  register(registrar, ports) {
    registrar.add(new ListProcesses(ports.processTable), processesView);
    registrar.add(new FindProcesses(ports.processTable), processesView);
    registrar.add(new EndProcesses(ports.processTable), killView);
    registrar.add(new ShowTree(ports.processTable), treeView);
  },
};
