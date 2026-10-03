import type { KiriyaModule } from "../../core/domain/module.js";
import { ScanSecrets } from "./application/scan-secrets.use-case.js";
import { scanView } from "./presentation/secrets.view.js";

export const secretsModule: KiriyaModule = {
  id: "secrets",
  summary: "secrets.summary",
  about: "secrets.about",
  examples: ["kiriya secrets scan", "kiriya secrets scan src --ext ts,js", "kiriya secrets scan --json"],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/secrets.md",
  register(registrar, ports) {
    registrar.add(new ScanSecrets(ports.fileSystem, ports.fileContent), scanView);
  },
};
