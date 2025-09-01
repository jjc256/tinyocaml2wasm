import { Expr } from "./ast";

export function showAST(e: Expr): string {
  const replacer = (_key: string, value: any) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value);
      keys.sort();
      const idx = keys.indexOf("tag");
      if (idx >= 0) {
        keys.splice(idx, 1);
        keys.unshift("tag");
      }
      const obj: any = {};
      for (const k of keys) obj[k] = value[k];
      return obj;
    }
    return value;
  };
  return JSON.stringify(e, replacer);
}
