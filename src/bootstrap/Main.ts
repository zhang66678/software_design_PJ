import { stdout } from "node:process";

export class Main {
  public run(): void {
    stdout.write("svg-editor 0.1.0\n");
  }
}

new Main().run();
