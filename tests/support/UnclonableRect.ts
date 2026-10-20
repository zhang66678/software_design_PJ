import { Rect } from "../../src/domain/shapes/Rect.js";

export class UnclonableRect extends Rect {
  public override clone(): Rect {
    throw new Error("cannot clone test rectangle");
  }
}
