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

export const PROXY_UNWRAP_KEY = '__SECRET_UNWRAP_KEY__';

export const NON_CONFIGURABLE = Object.freeze({configurable: false});

export const NON_WRITABLE = Object.freeze({writable: false});

export const NON_CONFIGURABLE_AND_WRITABLE = Object.freeze({
  configurable: false,
  writable: false,
});

export const CONFIGURABLE_AND_WRITABLE = Object.freeze({
  configurable: true,
  writable: true,
});

export const CANNOT_CLONE_ERROR =
  'Cloning built-in non-Array or non-Object objects is unsupported.';

export const STATUS_NONE = 1;

export const STATUS_CHANGED = 2;

export const STATUS_REVOKED = 3;
