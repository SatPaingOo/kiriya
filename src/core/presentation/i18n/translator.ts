import type { Catalog } from "../../../i18n/locales/en.js";
import { isMessage, type Message } from "../../domain/message.js";

const PLACEHOLDER = /\{([A-Za-z0-9]+)\}/g;

/** Turns messages into text from one catalog; nested messages in parameters are translated too. */
export class Translator {
  constructor(private readonly catalog: Catalog) {}

  text(value: Message): string {
    const template: string = this.catalog[value.key];
    return template.replace(PLACEHOLDER, (whole, name: string) => {
      const param = value.params[name];
      if (param === undefined) return whole;
      return isMessage(param) ? this.text(param) : String(param);
    });
  }
}
