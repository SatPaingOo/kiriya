import type { KiriyaModule } from "../core/domain/module.js";
import { archiveModule } from "../modules/archive/archive.module.js";
import { configModule } from "../modules/config/config.module.js";
import { convertModule } from "../modules/convert/convert.module.js";
import { dockerModule } from "../modules/docker/docker.module.js";
import { doctorModule } from "../modules/doctor/doctor.module.js";
import { envModule } from "../modules/env/env.module.js";
import { filesModule } from "../modules/files/files.module.js";
import { genModule } from "../modules/gen/gen.module.js";
import { gitModule } from "../modules/git/git.module.js";
import { sysModule } from "../modules/sys/sys.module.js";

/** Built-in modules, in no particular order; help lists them sorted. Adding a module is one line here. */
export const BUILT_IN_MODULES: readonly KiriyaModule[] = [
  filesModule,
  archiveModule,
  gitModule,
  dockerModule,
  configModule,
  doctorModule,
  genModule,
  convertModule,
  envModule,
  sysModule,
];
