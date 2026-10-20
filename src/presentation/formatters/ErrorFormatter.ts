export class ErrorFormatter {
  public format(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const singleLine = message.replace(/[\r\n]+/gu, " ").trim();
    return `error: ${singleLine || "unknown error"}`;
  }
}
