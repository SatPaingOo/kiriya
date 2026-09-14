import type { KiriyaModule } from "../../core/domain/module.js";
import type { TextView } from "../../core/domain/view.js";
import type { GeneratedOutput } from "./application/gen-options.js";
import { GeneratePasswords } from "./application/generate-passwords.use-case.js";
import { GenerateTokens } from "./application/generate-tokens.use-case.js";
import { GenerateUlids } from "./application/generate-ulids.use-case.js";
import { GenerateUuids } from "./application/generate-uuids.use-case.js";

/** One value per line, so the output can be piped or captured as it is. */
const valuesView: TextView<GeneratedOutput> = (output) => output.values;

export const genModule: KiriyaModule = {
  id: "gen",
  summary: "gen.summary",
  about: "gen.about",
  examples: ["kiriya gen uuid --v7", "kiriya gen password --length 32", "kiriya gen token --format hex"],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/gen.md",
  register(registrar, ports) {
    registrar.add(new GenerateUuids(ports.random, ports.clock), valuesView);
    registrar.add(new GenerateUlids(ports.random, ports.clock), valuesView);
    registrar.add(new GeneratePasswords(ports.random), valuesView);
    registrar.add(new GenerateTokens(ports.random), valuesView);
  },
};
