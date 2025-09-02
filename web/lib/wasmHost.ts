import wabt from "wabt";

export async function assembleWAT(wat: string): Promise<WebAssembly.Module> {
  const wabtMod = await wabt();
  const parsed = wabtMod.parseWat("module.wat", wat);
  const { buffer } = parsed.toBinary({});
  return await WebAssembly.compile(buffer);
}

export async function runWasm(mod: WebAssembly.Module, imports: any = {}): Promise<number> {
  const inst = await WebAssembly.instantiate(mod, imports);
  const res = (inst.exports.main as Function)();
  return res as number;
}

export const defaultHost = {
  print_int(n: number) {
    console.log(n);
  },
  print_bool(b: boolean) {
    console.log(b);
  },
  print_unit() {
    console.log("()");
  },
  now_ms() {
    return Date.now();
  }
};
