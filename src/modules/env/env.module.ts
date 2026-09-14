import type { KiriyaModule } from "../../core/domain/module.js";
import { CheckDotenv } from "./application/check-dotenv.use-case.js";
import { InspectPath } from "./application/inspect-path.use-case.js";
import { ShowVariables } from "./application/show-variables.use-case.js";
import { checkView, pathView, showView } from "./presentation/env.views.js";

export const envModule: KiriyaModule = {
  id: "env",
  summary: "env.summary",
  about: "env.about",
  examples: ["kiriya env show node", "kiriya env path", "kiriya env check"],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/env.md",
  register(registrar, ports) {
    registrar.add(new ShowVariables(ports.environment), showView);
    registrar.add(new InspectPath(ports.environment, ports.fileSystem), pathView);
    registrar.add(new CheckDotenv(ports.fileSystem, ports.fileContent), checkView);
  },
};
