import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every language file must have exactly the keys of strings_en.json (docs/PLAN.md section 5.7).
const dir = join(__dirname, "../apps/web/i18n");
const files = readdirSync(dir).filter((f) => /^strings_[a-z-]+\.json$/i.test(f));

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...out, [path]: value } : { ...out, ...flatten(value, path) };
  }, {});
}

const load = (file: string) => flatten(JSON.parse(readFileSync(join(dir, file), "utf8")));
const english = load("strings_en.json");

describe("strings files", () => {
  it("has the English source file", () => {
    expect(files).toContain("strings_en.json");
  });

  it("has no empty English strings", () => {
    const empty = Object.entries(english).filter(([, v]) => v.trim() === "");
    expect(empty).toEqual([]);
  });

  for (const file of files.filter((f) => f !== "strings_en.json")) {
    it(`${file} has the same keys as strings_en.json`, () => {
      const keys = Object.keys(load(file)).sort();
      expect(keys).toEqual(Object.keys(english).sort());
    });
  }
});
