/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
import day from "https://esm.sh/dayjs@1.11.3";
import { basename, extname } from "https://deno.land/std@0.146.0/path/mod.ts";
import { Manifest } from "fresh/server.ts";

const defaultWeight = 0.8;

export class SitemapContext {
  #url: string;
  #manifest: Manifest;
  #globalIgnore = ["sitemap.xml"];
  #additionalRoutes: Map<string, number> = new Map();

  constructor(url: string, manifest: Manifest) {
    this.#url = url;
    this.#manifest = manifest;
  }

  get routes() {
    return [
      ...Object.entries(this.#manifest.routes)
        .filter(([path]) => {
          // const isRootRoute = "./routes" === dirname(path);
          const file = basename(path);
          const fileName = file.replace(extname(file), "");
          const isDynamic = !!fileName.match(/^\[.+\]$/)?.length;

          if (
            isDynamic || fileName.startsWith("_") ||
            this.#globalIgnore.includes(fileName)
          ) {
            return false;
          }

          return true;
        })
        .map(([path, _]) => {
          const npath = path
            .replace(extname(path), "")
            .replace("./routes", "")
            .replace("index", ""); // We remove index as it's consider a "/" in Fresh

          const weight = npath == "/" ? 1.0 : defaultWeight;

          return [npath, weight];
        }),

      ...this.#additionalRoutes,
    ];
  }

  async add(route: string, weight = defaultWeight) {
    try {
      for await (const item of Deno.readDir(route)) {
        if (item.isFile && !item.name.startsWith("_")) {
          const npath = "/" + item.name
            .replace(extname(item.name), "");

          this.#additionalRoutes.set(npath, weight);
        }
      }
    } catch (_e: any) {
      this.#additionalRoutes.set(route, weight);
    }

    return this;
  }

  generate() {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
      ${
      this.routes.map(([route, weight]) => {
        return `<url>
          <loc>${this.#url}${route}</loc>
          <lastmod>${day().format("YYYY-MM-DD")}</lastmod>
          <changefreq>daily</changefreq>
          <priority>${(weight as number).toFixed(1)}</priority>
        </url>`;
      })
        .join("\n")
    }
    </urlset>`;
  }

  render() {
    return new Response(this.generate(), {
      headers: { "Content-Type": "application/xml" },
    });
  }
}
