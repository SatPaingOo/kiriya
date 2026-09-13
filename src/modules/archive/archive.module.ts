import type { KiriyaModule } from "../../core/domain/module.js";
import { CreateZip } from "./application/create-zip.use-case.js";
import { ExtractZip } from "./application/extract-zip.use-case.js";
import { unzipView } from "./presentation/unzip.view.js";
import { zipView } from "./presentation/zip.view.js";

export const archiveModule: KiriyaModule = {
  id: "archive",
  summary: "archive.summary",
  register(registrar, ports) {
    registrar.add(new CreateZip(ports.fileSystem, ports.fileContent, ports.compression), zipView);
    registrar.add(new ExtractZip(ports.fileSystem, ports.fileContent, ports.compression), unzipView);
  },
};
