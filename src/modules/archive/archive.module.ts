import type { KiriyaModule } from "../../core/domain/module.js";
import { CreateTar } from "./application/create-tar.use-case.js";
import { CreateZip } from "./application/create-zip.use-case.js";
import { ExtractTar } from "./application/extract-tar.use-case.js";
import { ExtractZip } from "./application/extract-zip.use-case.js";
import { tarView } from "./presentation/tar.view.js";
import { untarView } from "./presentation/untar.view.js";
import { unzipView } from "./presentation/unzip.view.js";
import { zipView } from "./presentation/zip.view.js";

export const archiveModule: KiriyaModule = {
  id: "archive",
  summary: "archive.summary",
  register(registrar, ports) {
    const { fileSystem, fileContent, compression } = ports;
    registrar.add(new CreateZip(fileSystem, fileContent, compression), zipView);
    registrar.add(new ExtractZip(fileSystem, fileContent, compression), unzipView);
    registrar.add(new CreateTar(fileSystem, fileContent, compression), tarView);
    registrar.add(new ExtractTar(fileSystem, fileContent, compression), untarView);
  },
};
