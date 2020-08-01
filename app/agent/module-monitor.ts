import { Service } from "./interfaces";

export class ModuleMonitor implements Service {
    handlers = {
        "module:get-functions": this.getFunctions,
        "module:resolve-symbols": this.resolveSymbols
    };

    constructor(private moduleMap: ModuleMap) {
        this.emitModules(moduleMap.values());
    }

    private emitModules = function (modules: Module[]) {
        const enrichedModules: EnrichedModule[] = modules
            .map(({ name, base, size, path }, i) => {
                const m: EnrichedModule = {
                    name,
                    base,
                    size,
                    path,
                };
                if (i === 0) {
                    m.main = true;
                }
                return m;
            });
        send({
            name: "modules:update",
            payload: enrichedModules
        });
    }

    getFunctions({ name }: ModuleRef): ModuleFunction[] {
        const m = find(this.moduleMap.values(), m => m.name === name);
        if (m === undefined) {
            throw new Error(`Module “${name}” not in map`);
        }

        const { base } = m;
        return m.enumerateExports()
            .filter(e => e.type === "function")
            .map(e => [e.name, e.address.sub(base).toInt32()]);
    }

    resolveSymbols({ module, offsets }: ResolveSymbolsQuery): ResolveSymbolsResult[] {
        const m = find(this.moduleMap.values(), m => m.path === module);
        if (m === undefined) {
            throw new Error(`Module “${module}” not in map`);
        }

        const { base } = m;
        return offsets.map(offset => DebugSymbol.fromAddress(base.add(offset)).name);
    }
}

export interface ModuleRef {
    name: string;
}

export type ModuleFunction = [ModuleFunctionName, ModuleRelativeOffset];
export type ModuleFunctionName = string;
export type ModuleRelativeOffset = number;

export interface ResolveSymbolsQuery {
    module: string;
    offsets: number[];
}

export type ResolveSymbolsResult = string | null;

interface EnrichedModule {
    name: string;
    base: NativePointer;
    size: number;
    path: string;
    main?: boolean;
}

function find<T>(array: T[], predicate: (candidate: T) => boolean): T | undefined {
    for (const element of array) {
        if (predicate(element)) {
            return element;
        }
    }
}