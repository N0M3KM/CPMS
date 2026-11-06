import type { Express } from 'express';

interface Layer {
  name: string;
  route?: { path: string; methods: Record<string, boolean>; stack: unknown[] };
  handle: { stack?: Layer[] };
  matchers: Array<(path: string) => { path: string } | false>;
}

// Lists "METHOD /path" for every route. Mounted routers need a known prefix (listed by the
// caller); an unknown mounted router throws so a new router cannot slip past the matrix test.
export function listRoutes(app: Express, knownMounts: string[]): string[] {
  const stack = (app as unknown as { router: { stack: Layer[] } }).router.stack;
  const out: string[] = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const m of Object.keys(layer.route.methods)) out.push(`${m.toUpperCase()} ${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle.stack) {
      const inner = layer.handle.stack.filter((l) => l.route);
      for (const l of inner) {
        const route = l.route!;
        const prefixes = knownMounts.filter((p) => layer.matchers[0]?.(p + route.path));
        if (prefixes.length !== 1) throw new Error(`Mounted router for ${route.path} needs a known prefix in the matrix test`);
        for (const m of Object.keys(route.methods)) out.push(`${m.toUpperCase()} ${prefixes[0]}${route.path}`);
      }
    }
  }
  return out.sort();
}
