import { ApplicationError } from "../errors/ApplicationError.js";

export class CommandArguments {
  readonly #values: readonly string[];

  public constructor(values: readonly string[]) {
    this.#values = [...values];
  }

  public expectCount(minimum: number, maximum: number, usage: string): void {
    if (this.#values.length < minimum || this.#values.length > maximum) {
      throw new ApplicationError(`usage: ${usage}`);
    }
  }

  public numberAt(index: number, name: string): number {
    const value = this.#values[index];
    if (value === undefined || value.trim().length === 0) {
      throw new ApplicationError(`${name} must be a finite number`);
    }

    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new ApplicationError(`${name} must be a finite number`);
    }

    return number;
  }

  public optionalAt(index: number): string | undefined {
    return this.#values[index];
  }

  public stringAt(index: number, name: string): string {
    const value = this.#values[index];
    if (value === undefined) {
      throw new ApplicationError(`${name} is required`);
    }

    return value;
  }

  public slice(start: number): readonly string[] {
    return this.#values.slice(start);
  }
}
