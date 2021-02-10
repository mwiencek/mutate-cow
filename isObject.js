export default function isObject(value) {
  const type = typeof value;
  return value && (type === 'object' || type === 'function');
}
