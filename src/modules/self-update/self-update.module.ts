import type { KiriyaModule } from "../../core/domain/module.js";
import { UpdateSelf } from "./application/update-self.use-case.js";
import { selfUpdateView } from "./presentation/self-update.view.js";

export const selfUpdateModule: KiriyaModule = {
  id: "self-update",
  summary: "self-update.summary",
  about: "self-update.about",
  // A module that is one command shows that command's examples, as doctor does.
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/self-update.md",
  register(registrar, ports) {
    registrar.add(new UpdateSelf(ports.network, ports.processRunner, ports.fileSystem, ports.runtime), selfUpdateView);
  },
};
