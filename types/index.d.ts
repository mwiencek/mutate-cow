type NestedProp<T, Path extends ReadonlyArray<PropertyKey>> =
  Path extends [infer First, ...infer Rest]
    ? (
      First extends keyof T
        ? NestedProp<T[First], Extract<Rest, ReadonlyArray<PropertyKey>>>
        : never
    )
    : T;

type NestedContext<T, R, ParentContext extends CowAnyContext<R> | null, Path extends ReadonlyArray<PropertyKey>> =
  Path extends [infer First, ...infer Rest]
    ? (
      First extends keyof T
        ? NestedContext<T[First], R, CowContext<T, R, ParentContext>, Extract<Rest, ReadonlyArray<PropertyKey>>>
        : never
    )
    : CowContext<T, R, ParentContext>;

type ShallowReadWrite<T> =
  T extends ReadonlyArray<infer V> ? Array<V> :
  T extends object ? {-readonly [K in keyof T]: T[K]} : never;

type CowRootContext<R> = CowContext<R, R, null>;

type CowAnyContext<R> =
  CowContext<unknown, R, CowAnyContext<R> | null>;

declare class CowContext<
  out T,
  out R,
  out ParentContext extends CowAnyContext<R> | null = CowAnyContext<R> | null,
> {
  read(): T;
  write(): ShallowReadWrite<T>;
  get<Path extends ReadonlyArray<PropertyKey>>(...path: Path): NestedContext<T, R, ParentContext, Path>;
  set<Path extends ReadonlyArray<PropertyKey>>(...args: [...Path, NestedProp<T, Path>]): this;
  update<Path extends ReadonlyArray<PropertyKey>>(...args: [...Path, (childContext: NestedContext<T, R, ParentContext, Path>) => unknown]): this;
  parent(): ParentContext;
  root(): CowRootContext<R>;
  revoke(): void;
  isRevoked(): boolean;
  final(): T;
  finalRoot(): R;
}

declare function mutate<T>(
  source: T,
): CowRootContext<T>;

export {CowRootContext, CowAnyContext, CowContext};
export default mutate;
