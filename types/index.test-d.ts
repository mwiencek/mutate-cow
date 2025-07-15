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

type ObjContext = CowContext<RoValueContainer, RoRoot, CowRootContext<RoRoot>>;

expectType<CowRootContext<RoRoot>>(ctx.get());
expectType<ObjContext>(ctx.get('obj'));
expectType<never>(ctx.get('does', 'not', 'exist'));

expectType<CowRootContext<RoRoot>>(ctx.set('obj', 'value', ''));
expectType<CowRootContext<RoRoot>>(ctx.set('obj', 'nested', 'value', ''));
expectError(ctx.set('obj', 'value', 0));
expectError(ctx.set('obj', 'nested', 'value', 0));
expectError(ctx.set('does', 'not', 'exist'));

expectType<CowRootContext<RoRoot>>(ctx.update((rootCtx: CowRootContext<RoRoot>) => undefined));
expectType<CowRootContext<RoRoot>>(ctx.update('obj', (childCtx: ObjContext) => undefined));
expectError(ctx.update());
expectError(ctx.update('no', 'updater'));
