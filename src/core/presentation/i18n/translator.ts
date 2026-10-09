import { isMessage, type Message } from "../../domain/message.js";

const PLACEHOLDER = /\{([A-Za-z0-9]+)\}/g;

/**
 * An own entry, or undefined. Both of these are looked up by a name a plugin chose, and a
 * plain object answers `constructor` and the rest of `Object.prototype` with a function:
 * as a template that is not a string to replace in, and as a parameter it prints as source.
 */
function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * Turns messages into text; nested messages in parameters are translated too. The
 * catalog is kiriya's own plus the messages of loaded plugins, so a key missing from
 * it is shown as the key rather than failing.
 */
export class Translator {
  constructor(private readonly catalog: Readonly<Record<string, string>>) {}

  text(value: Message): string {
    const template = own(this.catalog, value.key) ?? value.key;
    return template.replace(PLACEHOLDER, (whole, name: string) => {
      const param = own(value.params, name);
      if (param === undefined) return whole;
      return isMessage(param) ? this.text(param) : String(param);
    });
  }
}
