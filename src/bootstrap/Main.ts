import process from "node:process";
import { CommandExecutor } from "../application/commands/CommandExecutor.js";
import { ShapeFactory } from "../application/factories/ShapeFactory.js";
import { EditorSession } from "../application/session/EditorSession.js";
import { NodeTerminal } from "../infrastructure/terminal/NodeTerminal.js";
import { NodeSvgStorage } from "../infrastructure/storage/NodeSvgStorage.js";
import { SvgCodec } from "../infrastructure/svg/SvgCodec.js";
import { CliLoop } from "../presentation/cli/CliLoop.js";
import { CommandRegistry } from "../presentation/cli/CommandRegistry.js";
import { Tokenizer } from "../presentation/cli/Tokenizer.js";
import { DocumentFormatter } from "../presentation/formatters/DocumentFormatter.js";
import { ErrorFormatter } from "../presentation/formatters/ErrorFormatter.js";

export class Main {
  public async run(): Promise<void> {
    const session = new EditorSession();
    const executor = new CommandExecutor(session);
    const factory = new ShapeFactory();
    const storage = new NodeSvgStorage(new SvgCodec(factory));
    const registry = new CommandRegistry(factory, session, new DocumentFormatter(), storage);
    const loop = new CliLoop(new NodeTerminal(), new Tokenizer(), registry, executor, new ErrorFormatter());
    await loop.run();
  }
}

new Main().run().catch((error: unknown) => {
  process.stderr.write(`${new ErrorFormatter().format(error)}\n`);
  process.exitCode = 1;
});
