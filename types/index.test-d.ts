import {
  expectType,
  expectNotType,
  expectError,
} from 'tsd';

import mutate, {
  type CowContext,
  type CowRootContext,
} from './index';

interface RoRoot {
  readonly obj: RoValueContainer;
  readonly arr: ReadonlyArray<RoValueContainer>;
}

interface RwRoot {
  obj: RoValueContainer;
  arr: ReadonlyArray<RoValueContainer>;
}

interface RoValueContainer {
  readonly value: string;
  readonly nested: RoValueContainer;
}

const _root: any = {
  obj: {
    value: '',
    nested: null,
  },
  arr: [],
};
_root.obj.nested = _root.obj;
const root: RoRoot = _root;

const ctx = mutate(root);

expectType<RoRoot>(ctx.read());
expectNotType<RwRoot>(ctx.read());

expectType<RwRoot>(ctx.write());
expectNotType<RoRoot>(ctx.write());

type ObjContext = CowContext<RoValueContainer, CowRootContext<RoRoot>>;

expectType<CowRootContext<RoRoot>>(ctx.get());
expectType<ObjContext>(ctx.get('obj'));
expectType<never>(ctx.get('does', 'not', 'exist'));

expectType<CowRootContext<RoRoot>>(ctx.set('obj', 'value', ''));
expectType<CowRootContext<RoRoot>>(ctx.set('obj', 'nested', 'value', ''));
expectError(ctx.set('obj', 'value', 0));
expectError(ctx.set('obj', 'nested', 'value', 0));
expectError(ctx.set('does', 'not', 'exist'));

expectType<CowRootContext<RoRoot>>(ctx.merge({}));
expectType<CowRootContext<RoRoot>>(ctx.merge({obj: {value: ''}}));
expectType<CowRootContext<RoRoot>>(ctx.merge({obj: {nested: {value: ''}}}));
expectError(ctx.merge({obj: {value: 0}}));
expectError(ctx.merge({obj: {nested: {value: 0}}}));
expectError(ctx.merge({doesNotExist: ''}));
expectError(ctx.merge(''));
expectType<ObjContext>(ctx.get('obj').merge({value: ''}));

expectType<CowRootContext<RoRoot>>(ctx.update((rootCtx: CowRootContext<RoRoot>) => undefined));
expectType<CowRootContext<RoRoot>>(ctx.update('obj', (childCtx: ObjContext) => undefined));
expectError(ctx.update());
expectError(ctx.update('no', 'updater'));

expectType<CowRootContext<null>>(mutate(null));
expectType<CowRootContext<undefined>>(mutate(undefined));
expectType<CowRootContext<true>>(mutate(true));
expectType<CowRootContext<false>>(mutate(false));
expectType<CowRootContext<number>>(mutate(3));
expectType<CowRootContext<bigint>>(mutate(BigInt('3')));
expectType<CowRootContext<string>>(mutate(''));
expectType<CowRootContext<symbol>>(mutate(Symbol('3')));

expectType<string>(ctx.get('obj', 'value').write());
expectType<number>(mutate(3).write());
expectType<null>(mutate(null).write());

type ArrContext = CowContext<ReadonlyArray<RoValueContainer>, CowRootContext<RoRoot>>;

expectType<Array<RoValueContainer>>(ctx.get('arr').write());
expectType<CowContext<RoValueContainer, ArrContext>>(ctx.get('arr', 0));
expectType<never>(ctx.get('arr', 'length'));
expectType<never>(ctx.get('arr', 'concat'));

interface MergeRoot {
  readonly arr: ReadonlyArray<string>;
  readonly fn: (x: number) => string;
  readonly obj: RoValueContainer;
}

declare const mergeCtx: CowRootContext<MergeRoot>;

expectType<CowRootContext<MergeRoot>>(mergeCtx.merge({arr: ['a']}));
expectError(mergeCtx.merge({arr: {0: 'a'}}));
expectType<CowRootContext<MergeRoot>>(mergeCtx.merge({fn: (x: number) => ''}));
expectError(mergeCtx.merge({fn: {}}));
expectError(mergeCtx.merge({fn: 123}));

expectType<CowRootContext<MergeRoot>>(mergeCtx.merge({obj: {value: 'x'}}));
expectError(mergeCtx.merge({obj: {value: 1}}));

declare const arrCtx: CowRootContext<ReadonlyArray<string>>;
expectError(arrCtx.merge({0: 'a'}));
expectError(arrCtx.merge(['a']));

expectError(mutate(3).merge({}));
expectError(mutate('').merge({}));
