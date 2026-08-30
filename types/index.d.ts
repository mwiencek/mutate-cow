type KeyOf<T> =
  T extends ReadonlyArray<unknown> ? number : keyof T;

type PropOf<T, K> =
  T extends ReadonlyArray<infer V> ? V :
  K extends keyof T ? T[K] : never;

type NestedProp<T, Path extends ReadonlyArray<PropertyKey>> =
  Path extends [infer First, ...infer Rest]
    ? (
      First extends KeyOf<T>
        ? NestedProp<PropOf<T, First>, Extract<Rest, ReadonlyArray<PropertyKey>>>
        : never
    )
    : T;

type NestedContext<T, ParentContext, Path extends ReadonlyArray<PropertyKey>> =
  Path extends [infer First, ...infer Rest]
    ? (
      First extends KeyOf<T>
        ? NestedContext<PropOf<T, First>, CowContext<T, ParentContext>, Extract<Rest, ReadonlyArray<PropertyKey>>>
        : never
    )
    : CowContext<T, ParentContext>;

type NonMergeableObject =
  | ReadonlyArray<unknown>
  | ((...args: never[]) => unknown)
  | Date
  | RegExp
  | Error
  | Promise<unknown>
  | ReadonlyMap<unknown, unknown>
  | ReadonlySet<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>
  | ArrayBuffer
  | ArrayBufferView;

type MergeValue<V> =
  V extends NonMergeableObject ? V :
  V extends object ? V | MergeObject<V> :
  V;

type MergeObject<T> =
  T extends NonMergeableObject ? never :
  T extends object ? {[K in keyof T]?: MergeValue<T[K]>} :
  never;

type ShallowReadWrite<T> =
  T extends ReadonlyArray<infer V> ? Array<V> :
  T extends object ? {-readonly [K in keyof T]: T[K]} : T;

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
  out ParentContext = CowAnyContext | null,
> {
  read(): T;
  write(): ShallowReadWrite<T>;
  get<Path extends ReadonlyArray<PropertyKey>>(...path: Path): NestedContext<T, ParentContext, Path>;
  set<Path extends ReadonlyArray<PropertyKey>>(...args: [...Path, NestedProp<T, Path>]): this;
  merge(object: MergeObject<T>): this;
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
): CowRootContext<T>;

export {CowRootContext, CowAnyContext, CowContext};
export default mutate;
