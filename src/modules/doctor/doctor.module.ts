import type { KiriyaModule } from "../../core/domain/module.js";
import { RunChecks } from "./application/run-checks.use-case.js";
import { doctorView } from "./presentation/doctor.view.js";

export const doctorModule: KiriyaModule = {
  id: "doctor",
  summary: "doctor.summary",
  register(registrar, ports) {
    const { processRunner, environment, config, trash, clipboard, plugins, runtime } = ports;
    registrar.add(new RunChecks(processRunner, environment, config, trash, clipboard, plugins, runtime), doctorView);
  },
};
