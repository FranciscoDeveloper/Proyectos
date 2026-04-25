export class Router {
  #routes = [];

  add(method, pattern, handler) {
    this.#routes.push({ method, pattern, handler });
    return this;
  }

  match(method, path) {
    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const match = path.match(route.pattern);
      if (match) {
        return { handler: route.handler, params: match.slice(1) };
      }
    }
    return null;
  }
}
