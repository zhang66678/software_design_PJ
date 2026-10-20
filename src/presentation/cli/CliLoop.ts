import type { CommandExecutor } from "../../application/commands/CommandExecutor.js";
import type { ErrorFormatter } from "../formatters/ErrorFormatter.js";
import type { Terminal } from "../ports/Terminal.js";
import type { CommandRegistry } from "./CommandRegistry.js";
import type { Tokenizer } from "./Tokenizer.js";

export class CliLoop {
  readonly #terminal: Terminal;
  readonly #tokenizer: Tokenizer;
  readonly #registry: CommandRegistry;
  readonly #executor: CommandExecutor;
  readonly #errors: ErrorFormatter;

  public constructor(
    terminal: Terminal,
    tokenizer: Tokenizer,
    registry: CommandRegistry,
    executor: CommandExecutor,
    errors: ErrorFormatter,
  ) {
    this.#terminal = terminal;
    this.#tokenizer = tokenizer;
    this.#registry = registry;
    this.#executor = executor;
    this.#errors = errors;
  }

  public async run(): Promise<void> {
    try {
      this.#terminal.writeLine("svg-editor 0.1.0 — type 'help' for commands");
      this.#terminal.prompt("svg> ");
      for await (const line of this.#terminal.readLines()) {
        try {
          const tokens = this.#tokenizer.tokenize(line);
          if (tokens.length > 0) {
            this.#terminal.writeLine(this.#registry.parse(tokens).execute(this.#executor));
          }
        } catch (error: unknown) {
          this.#terminal.writeError(this.#errors.format(error));
        }
        this.#terminal.prompt("svg> ");
      }
    } finally {
      this.#terminal.close();
    }
  }
}
