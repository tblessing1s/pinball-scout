export function indexBy(items, keyOrFn) {
  const keyFn = typeof keyOrFn === "function" ? keyOrFn : (item) => item?.[keyOrFn];
  return new Map(items.map((item) => [keyFn(item), item]));
}
