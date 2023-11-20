export const NON_CONFIGURABLE =
  Object.freeze({configurable: false});

export const NON_WRITABLE =
  Object.freeze({writable: false});

export const NON_CONFIGURABLE_AND_WRITABLE =
  Object.freeze({
    configurable: false,
    writable: false,
  });

export const CONFIGURABLE_AND_WRITABLE =
  Object.freeze({
    configurable: true,
    writable: true,
  });

export const STATUS_NONE = 1;

export const STATUS_CHANGED = 2;

export const STATUS_REVOKED = 3;
