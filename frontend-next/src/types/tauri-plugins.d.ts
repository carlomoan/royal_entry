declare module "@tauri-apps/plugin-store" {
  export class LazyStore {
    constructor(path: string, options?: unknown);
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
    save(): Promise<void>;
  }
}
