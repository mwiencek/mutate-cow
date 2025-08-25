type NestedProp<T, Path extends ReadonlyArray<PropertyKey>> =
  Path extends [infer First, ...infer Rest]
    ? (
      First extends keyof T
        ? NestedProp<T[First], Extract<Rest, ReadonlyArray<PropertyKey>>>
        : never
    )
    : T;

type NestedContext<T, ParentContext extends CowAnyContext | null, Path extends ReadonlyArray<PropertyKey>> =
  Path extends [infer First, ...infer Rest]
    ? (
      First extends keyof T
        ? NestedContext<T[First], CowContext<T, ParentContext>, Extract<Rest, ReadonlyArray<PropertyKey>>>
        : never
    )
    : CowContext<T, ParentContext>;

type ShallowReadWrite<T> =
  T extends ReadonlyArray<infer V> ? Array<V> :
  T extends object ? {-readonly [K in keyof T]: T[K]} : never;

type CowRootContext<R> = CowContext<R, null>;

type CowAnyContext =
  CowContext<unknown, CowAnyContext | null>;

type GetCowContextSource<C> =
  C extends CowContext<infer T, CowAnyContext | null>
    ? T
    : never;

type GetCowContextRoot<C> =
  C extends CowContext<infer T, infer P>
    ? (P extends null ? C : GetCowContextRoot<P>)
    : never;

declare class CowContext<
  out T,
  // @ts-ignore
  out ParentContext extends CowAnyContext | null = CowAnyContext | null,
> {
  read(): T;
  write(): ShallowReadWrite<T>;
  get<Path extends ReadonlyArray<PropertyKey>>(...path: Path): NestedContext<T, ParentContext, Path>;
  set<Path extends ReadonlyArray<PropertyKey>>(...args: [...Path, NestedProp<T, Path>]): this;
  update<Path extends ReadonlyArray<PropertyKey>>(...args: [...Path, (childContext: NestedContext<T, ParentContext, Path>) => unknown]): this;
  dangerouslySetAsMutable(): void;
  parent(): ParentContext;
  root(): GetCowContextRoot<this>;
  revoke(): void;
  isRevoked(): boolean;
  final(): T;
  finalRoot(): GetCowContextSource<GetCowContextRoot<this>>;
}

declare function mutate<T>(
  source: T,
  strict?: boolean,
): CowRootContext<T>;

export {CowRootContext, CowAnyContext, CowContext};
export default mutate;
