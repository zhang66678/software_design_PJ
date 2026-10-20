export class PresentationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PresentationError";
  }
}
