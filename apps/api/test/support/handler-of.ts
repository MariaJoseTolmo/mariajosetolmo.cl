/** Looks up a controller method as a handler reference, for guard unit tests. */
export function handlerOf<T extends object>(
  controller: new () => T,
  name: keyof T & string,
): () => void {
  const handler = Reflect.get(controller.prototype, name) as () => void;
  return handler;
}
