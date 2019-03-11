export const EMPTY_ARRAY = [];

let proxySupport = true;
try {
  eval('new Proxy({}, {})');
} catch (e) {
  proxySupport = false;
}

export const PROXY_SUPPORT = proxySupport;

export const PROXY_TARGETS = new WeakMap();
