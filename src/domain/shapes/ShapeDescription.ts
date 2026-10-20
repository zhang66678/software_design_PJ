export type ShapeAttributes = Readonly<Record<string, string | number>>;

export interface ShapeDescription {
  readonly id: string;
  readonly type: string;
  readonly attributes: ShapeAttributes;
  readonly textContent?: string;
}
