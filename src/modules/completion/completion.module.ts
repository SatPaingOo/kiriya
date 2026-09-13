import type { KiriyaModule } from "../../core/domain/module.js";
import { PrintScript } from "./application/print-script.use-case.js";
import { SuggestWords } from "./application/suggest-words.use-case.js";
import { scriptView, suggestView } from "./presentation/completion.views.js";

export const completionModule: KiriyaModule = {
  id: "completion",
  summary: "completion.summary",
  register(registrar, ports) {
    registrar.add(new PrintScript(), scriptView);
    registrar.add(new SuggestWords(ports.commands), suggestView);
  },
};
