import { randomUUID } from "node:crypto";
import { closeSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { ApplicationError } from "../../application/errors/ApplicationError.js";
import type { SvgReadResult, SvgStorage } from "../../application/ports/SvgStorage.js";
import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { SvgCodec } from "../svg/SvgCodec.js";

export class NodeSvgStorage implements SvgStorage {
  readonly #codec: SvgCodec;

  public constructor(codec: SvgCodec = new SvgCodec()) {
    this.#codec = codec;
  }

  public read(filePath: string): SvgReadResult {
    let source: string;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(filePath));
    } catch {
      throw new ApplicationError(`cannot read file: ${filePath}`);
    }

    return this.#codec.decode(source);
  }

  public save(document: SvgDocument, filePath: string): void {
    const content = this.#codec.encode(document);
    let ownedTemporary: string | undefined;
    try {
      const target = resolve(filePath);
      const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
      const descriptor = openSync(temporary, "wx");
      ownedTemporary = temporary;
      try {
        writeFileSync(descriptor, content, "utf8");
      } finally {
        closeSync(descriptor);
      }
      renameSync(temporary, target);
    } catch {
      if (ownedTemporary !== undefined) {
        try {
          rmSync(ownedTemporary, { force: true });
        } catch {
          // Preserve the original write error if temporary-file cleanup also fails.
        }
      }
      throw new ApplicationError(`cannot write file: ${filePath}`);
    }
  }
}
