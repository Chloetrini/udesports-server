declare module 'memjs' {
  export class Client {
    static create(servers?: string, options?: Record<string, unknown>): Client;
    get(key: string): Promise<{ value: Buffer | null }>;
    set(key: string, value: string | Buffer, options?: Record<string, unknown>): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    flush(): Promise<boolean[]>;
    increment(key: string, amount: number, options?: Record<string, unknown>): Promise<{ value: number | null; success: boolean }>;
    quit(): void;
  }
}
