import type { KiriyaModule } from "../../core/domain/module.js";
import { CheckConnection } from "./application/check-connection.use-case.js";
import { ListAddresses } from "./application/list-addresses.use-case.js";
import { LookupName } from "./application/lookup-name.use-case.js";
import { addressesView, checkView, dnsView } from "./presentation/net.views.js";

export const netModule: KiriyaModule = {
  id: "net",
  summary: "net.summary",
  register(registrar, ports) {
    registrar.add(new ListAddresses(ports.network), addressesView);
    registrar.add(new CheckConnection(ports.network), checkView);
    registrar.add(new LookupName(ports.network), dnsView);
  },
};
