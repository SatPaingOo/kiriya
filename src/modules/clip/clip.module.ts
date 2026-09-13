import type { KiriyaModule } from "../../core/domain/module.js";
import { CopyText } from "./application/copy-text.use-case.js";
import { PasteText } from "./application/paste-text.use-case.js";
import { copyView, pasteView } from "./presentation/clip.views.js";

export const clipModule: KiriyaModule = {
  id: "clip",
  summary: "clip.summary",
  register(registrar, ports) {
    const sources = { stdin: ports.stdin, fileSystem: ports.fileSystem, content: ports.fileContent };
    registrar.add(new CopyText(ports.clipboard, sources), copyView);
    registrar.add(new PasteText(ports.clipboard), pasteView);
  },
};
