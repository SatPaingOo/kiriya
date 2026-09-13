import type { KiriyaModule } from "../../core/domain/module.js";
import { ConvertCase } from "./application/convert-case.use-case.js";
import { ConvertCodec } from "./application/convert-codecs.use-case.js";
import { ConvertJson } from "./application/convert-json.use-case.js";
import { ConvertTime } from "./application/convert-time.use-case.js";
import { DecodeJwt } from "./application/decode-jwt.use-case.js";
import { jsonView, jwtView, outputView, timeView } from "./presentation/convert.views.js";

export const convertModule: KiriyaModule = {
  id: "convert",
  summary: "convert.summary",
  register(registrar, ports) {
    const sources = { stdin: ports.stdin, fileSystem: ports.fileSystem, content: ports.fileContent };
    registrar.add(new ConvertCodec("base64", sources), outputView);
    registrar.add(new ConvertCodec("hex", sources), outputView);
    registrar.add(new ConvertCodec("url", sources), outputView);
    registrar.add(new ConvertJson(sources), jsonView);
    registrar.add(new DecodeJwt(sources, ports.clock), jwtView);
    registrar.add(new ConvertTime(ports.clock), timeView);
    registrar.add(new ConvertCase(sources), outputView);
  },
};
