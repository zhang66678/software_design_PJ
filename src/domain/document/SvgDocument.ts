import { DomainError } from "../errors/DomainError.js";
import { Group } from "../shapes/Group.js";
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
      this.replace(container.id, [container.withChildren([...container.getChildren(), shape])]);
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

  public group(id: string, shapeIds: readonly string[]): Group {
    if (this.find(id, this.#shapes) !== undefined) {
      throw new DomainError(`id already exists: ${id}`);
    }
    const selected = new Set<string>();
    for (const shapeId of shapeIds) {
      if (selected.has(shapeId)) {
        throw new DomainError(`duplicate group target: ${shapeId}`);
      }
      this.getShape(shapeId);
      selected.add(shapeId);
    }
    const shapes = this.#shapes.flatMap((root) => [...root.walk()]).filter((shape) => selected.has(shape.id));
    const first = shapes[0];
    if (first === undefined) {
      throw new DomainError("group requires at least one shape");
    }
    for (const shape of shapes) {
      for (const descendant of shape.walk()) {
        if (descendant.id !== shape.id && selected.has(descendant.id)) {
          throw new DomainError(`cannot group a container into its own descendant: ${shape.id}`);
        }
      }
    }
    const group = new Group(id, shapes);
    const parent = this.getParent(first.id);
    if (shapes.every((shape) => this.getParent(shape.id) === parent)) {
      for (const shape of shapes.slice(1)) {
        this.remove(shape.id);
      }
      this.replace(first.id, [group]);
    } else {
      for (const shape of shapes) {
        this.remove(shape.id);
      }
      this.add(group);
    }

    return group;
  }

  public ungroup(id: string): Shape {
    const group = this.getContainer(id);
    if (this.getParent(id) === undefined) {
      throw new DomainError(`cannot ungroup top-level container: ${id}`);
    }
    this.replace(id, group.getChildren());
    return group;
  }

  public bringToFront(id: string): Shape {
    return this.reorder(id, true);
  }

  public sendToBack(id: string): Shape {
    return this.reorder(id, false);
  }

  public getShapes(): readonly Shape[] {
    return Object.freeze([...this.#shapes]);
  }

  public clone(): SvgDocument {
    return this.withSize(this.#width, this.#height);
  }

  public withSize(width: number, height: number): SvgDocument {
    const copy = new SvgDocument(width, height);
    for (const shape of this.#shapes) {
      copy.add(shape.clone());
    }

    return copy;
  }

  private reorder(id: string, toFront: boolean): Shape {
    const { shape, parent } = this.requireLocation(id);
    const siblings = parent === undefined ? this.#shapes : parent.getChildren();
    const updated = siblings.filter((sibling) => sibling.id !== id);
    if (toFront) {
      updated.push(shape);
    } else {
      updated.unshift(shape);
    }
    if (parent === undefined) {
      this.#shapes.splice(0, this.#shapes.length, ...updated);
    } else {
      this.replace(parent.id, [parent.withChildren(updated)]);
    }

    return shape;
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

  private replace(id: string, replacements: readonly Shape[] = []): void {
    const shapes = this.#shapes.flatMap((shape) => this.replaceIn(shape, id, replacements));
    this.#shapes.splice(0, this.#shapes.length, ...shapes);
  }

  private replaceIn(shape: Shape, id: string, replacements: readonly Shape[]): readonly Shape[] {
    if (shape.id === id) {
      return replacements;
    }
    const children = shape.getChildren();
    const updated = children.flatMap((child) => this.replaceIn(child, id, replacements));
    if (updated.length === children.length && updated.every((child, index) => child === children[index])) {
      return [shape];
    }

    return [shape.withChildren(updated)];
  }
}
