import type { KiriyaModule } from "../core/domain/module.js";
import { archiveModule } from "../modules/archive/archive.module.js";
import { filesModule } from "../modules/files/files.module.js";

/** Built-in modules, in no particular order; help lists them sorted. Adding a module is one line here. */
export const BUILT_IN_MODULES: readonly KiriyaModule[] = [filesModule, archiveModule];
