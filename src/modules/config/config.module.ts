import type { KiriyaModule } from "../../core/domain/module.js";
import { GetSetting } from "./application/get-setting.use-case.js";
import { ListConfigKeys } from "./application/list-config-keys.use-case.js";
import { ListSettings } from "./application/list-settings.use-case.js";
import { SetSetting } from "./application/set-setting.use-case.js";
import { ShowConfigPath } from "./application/show-config-path.use-case.js";
import { UnsetSetting } from "./application/unset-setting.use-case.js";
import { getView, keysView, listView, pathView, setView, unsetView } from "./presentation/config.views.js";

export const configModule: KiriyaModule = {
  id: "config",
  summary: "config.summary",
  register(registrar, ports) {
    registrar.add(new ShowConfigPath(ports.config), pathView);
    registrar.add(new ListConfigKeys(), keysView);
    registrar.add(new ListSettings(ports.config), listView);
    registrar.add(new GetSetting(ports.config), getView);
    registrar.add(new SetSetting(ports.config), setView);
    registrar.add(new UnsetSetting(ports.config), unsetView);
  },
};
