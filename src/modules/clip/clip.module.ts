import type { KiriyaModule } from "../../core/domain/module.js";
import { CopyText } from "./application/copy-text.use-case.js";
import { PasteText } from "./application/paste-text.use-case.js";
import { copyView, pasteView } from "./presentation/clip.views.js";

export const clipModule: KiriyaModule = {
  id: "clip",
  summary: "clip.summary",
  about: "clip.about",
  examples: ['kiriya clip copy "hello"', "kiriya clip copy --file notes.md", "kiriya clip paste"],
  guide: "https://github.com/SatPaingOo/kiriya/blob/main/docs/modules/clip.md",
  register(registrar, ports) {
    const sources = { stdin: ports.stdin, fileSystem: ports.fileSystem, content: ports.fileContent };
    registrar.add(new CopyText(ports.clipboard, sources), copyView);
    registrar.add(new PasteText(ports.clipboard), pasteView);
  },
};
