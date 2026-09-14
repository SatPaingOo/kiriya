import type { KiriyaModule } from "../../core/domain/module.js";
import { PrintScript } from "./application/print-script.use-case.js";
import { SuggestWords } from "./application/suggest-words.use-case.js";
import { scriptView, suggestView } from "./presentation/completion.views.js";

export const completionModule: KiriyaModule = {
  id: "completion",
  summary: "completion.summary",
  about: "completion.about",
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/completion.md",
  register(registrar, ports) {
    registrar.add(new PrintScript(), scriptView);
    registrar.add(new SuggestWords(ports.commands), suggestView);
  },
};
