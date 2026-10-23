import { DomainError } from "../errors/DomainError.js";
import type { Shape } from "../shapes/Shape.js";

interface ShapeLocation {
  readonly shape: Shape;
  readonly parent: Shape | undefined;
}

export class SvgDocument {
  readonly #width: number;
  readonly #height: number;
  readonly #shapes: Shape[] = [];

  public constructor(width = 800, height = 600) {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new DomainError("canvas dimensions must be positive finite numbers");
    }

    this.#width = width;
    this.#height = height;
  }

  public get width(): number {
    return this.#width;
  }

  public get height(): number {
    return this.#height;
  }

  public add(shape: Shape, containerId?: string): void {
    const container = containerId === undefined ? undefined : this.getContainer(containerId);
    const ids = new Set(this.#shapes.flatMap((root) => [...root.walk()].map((node) => node.id)));
    for (const node of shape.walk()) {
      if (ids.has(node.id)) {
        throw new DomainError(`id already exists: ${node.id}`);
      }
      ids.add(node.id);
    }

    if (container === undefined) {
      this.#shapes.push(shape);
    } else {
      this.replace(container.id, container.withChildren([...container.getChildren(), shape]));
    }
  }

  public getShape(id: string): Shape {
    return this.requireLocation(id).shape;
  }

  public getParent(id: string): Shape | undefined {
    return this.requireLocation(id).parent;
  }

  public getContainer(id: string): Shape {
    const location = this.find(id, this.#shapes);
    if (location === undefined) {
      throw new DomainError(`no such container: ${id}`);
    }
    if (!location.shape.isContainer) {
      throw new DomainError(`not a container: ${id}`);
    }

    return location.shape;
  }

  public remove(id: string): Shape {
    const shape = this.getShape(id);
    this.replace(id);
    return shape;
  }

  public addTo(containerId: string, id: string): Shape {
    const container = this.getContainer(containerId);
    const shape = this.getShape(id);
    if ([...shape.walk()].some((node) => node.id === container.id)) {
      throw new DomainError(`cannot add a shape into itself or its descendant: ${id}`);
    }

    this.remove(id);
    // Removal rebuilds ancestors; add resolves the current target by id again.
    this.add(shape, containerId);
    return shape;
  }

  public getShapes(): readonly Shape[] {
    return Object.freeze([...this.#shapes]);
  }

  public clone(): SvgDocument {
    const copy = new SvgDocument(this.#width, this.#height);
    for (const shape of this.#shapes) {
      copy.add(shape.clone());
    }

    return copy;
  }

  private requireLocation(id: string): ShapeLocation {
    const location = this.find(id, this.#shapes);
    if (location === undefined) {
      throw new DomainError(`no such shape: ${id}`);
    }

    return location;
  }

  private find(id: string, shapes: readonly Shape[], parent?: Shape): ShapeLocation | undefined {
    for (const shape of shapes) {
      if (shape.id === id) {
        return { shape, parent };
      }
      const location = this.find(id, shape.getChildren(), shape);
      if (location !== undefined) {
        return location;
      }
    }

    return undefined;
  }

  private replace(id: string, replacement?: Shape): void {
    const shapes = this.#shapes.map((shape) => this.replaceIn(shape, id, replacement))
      .filter((shape): shape is Shape => shape !== undefined);
    this.#shapes.splice(0, this.#shapes.length, ...shapes);
  }

  private replaceIn(shape: Shape, id: string, replacement: Shape | undefined): Shape | undefined {
    if (shape.id === id) {
      return replacement;
    }
    const children = shape.getChildren();
    const updated = children.map((child) => this.replaceIn(child, id, replacement))
      .filter((child): child is Shape => child !== undefined);
    if (updated.length === children.length && updated.every((child, index) => child === children[index])) {
      return shape;
    }

    return shape.withChildren(updated);
  }
}
