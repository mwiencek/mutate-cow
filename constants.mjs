export let PROXY_SUPPORT = true;
try {
  eval('new Proxy({}, {})');
} catch (e) {
  PROXY_SUPPORT = false;
}

export const noProxy = (cb) => {
  const oldValue = PROXY_SUPPORT;
  PROXY_SUPPORT = false;
  cb();
  PROXY_SUPPORT = oldValue;
};

export const PROXY_CONTEXT = new WeakMap();

export const CONFIGURABLE_AND_WRITABLE = Object.freeze({
  configurable: true,
  writable: true,
});
