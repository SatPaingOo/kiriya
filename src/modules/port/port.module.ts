import type { KiriyaModule } from "../../core/domain/module.js";
import { EndPortOwners } from "./application/end-port-owners.use-case.js";
import { FindFreePort } from "./application/find-free-port.use-case.js";
import { FindListeners } from "./application/find-listeners.use-case.js";
import { freeView, killView, whoView } from "./presentation/port.views.js";

export const portModule: KiriyaModule = {
  id: "port",
  summary: "port.summary",
  register(registrar, ports) {
    registrar.add(new FindListeners(ports.portTable, ports.processTable), whoView);
    registrar.add(new EndPortOwners(ports.portTable, ports.processTable), killView);
    registrar.add(new FindFreePort(ports.portTable), freeView);
  },
};
