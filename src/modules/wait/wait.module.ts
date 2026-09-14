import type { KiriyaModule } from "../../core/domain/module.js";
import { WaitForFile } from "./application/wait-file.use-case.js";
import { WaitForPort } from "./application/wait-port.use-case.js";
import { WaitForUrl } from "./application/wait-url.use-case.js";
import { fileView, portView, urlView } from "./presentation/wait.views.js";

export const waitModule: KiriyaModule = {
  id: "wait",
  summary: "wait.summary",
  about: "wait.about",
  examples: [
    "kiriya wait port 5432",
    "kiriya wait url http://localhost:3000/health",
    "kiriya wait file dist/app.js --timeout 120",
  ],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/wait.md",
  register(registrar, ports) {
    registrar.add(new WaitForPort(ports.network, ports.clock), portView);
    registrar.add(new WaitForUrl(ports.network, ports.clock), urlView);
    registrar.add(new WaitForFile(ports.fileSystem, ports.clock), fileView);
  },
};
