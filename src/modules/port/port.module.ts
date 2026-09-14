import type { KiriyaModule } from "../../core/domain/module.js";
import { EndPortOwners } from "./application/end-port-owners.use-case.js";
import { FindFreePort } from "./application/find-free-port.use-case.js";
import { FindListeners } from "./application/find-listeners.use-case.js";
import { freeView, killView, whoView } from "./presentation/port.views.js";

export const portModule: KiriyaModule = {
  id: "port",
  summary: "port.summary",
  about: "port.about",
  examples: ["kiriya port who 3000", "kiriya port kill 3000", "kiriya port free --from 8000"],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/port.md",
  register(registrar, ports) {
    registrar.add(new FindListeners(ports.portTable, ports.processTable), whoView);
    registrar.add(new EndPortOwners(ports.portTable, ports.processTable), killView);
    registrar.add(new FindFreePort(ports.portTable), freeView);
  },
};
