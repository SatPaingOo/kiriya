import { isMessage, type Message } from "../../domain/message.js";

const PLACEHOLDER = /\{([A-Za-z0-9]+)\}/g;

/**
 * Turns messages into text; nested messages in parameters are translated too. The
 * catalog is kiriya's own plus the messages of loaded plugins, so a key missing from
 * it is shown as the key rather than failing.
 */
export class Translator {
  constructor(private readonly catalog: Readonly<Record<string, string>>) {}

  text(value: Message): string {
    const template = this.catalog[value.key] ?? value.key;
    return template.replace(PLACEHOLDER, (whole, name: string) => {
      const param = value.params[name];
      if (param === undefined) return whole;
      return isMessage(param) ? this.text(param) : String(param);
    });
  }
}
