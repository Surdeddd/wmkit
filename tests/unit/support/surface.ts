import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../../', import.meta.url))

export const ENTRIES: Record<string, string> = {
  '.': 'src/index.ts',
  './react': 'src/adapters/react.ts',
  './vue': 'src/adapters/vue.ts',
  './svelte': 'src/adapters/svelte.ts',
  './solid': 'src/adapters/solid.ts',
  './angular': 'src/adapters/angular.ts',
  './preact': 'src/adapters/preact.ts',
  './lit': 'src/adapters/lit.ts',
  './qwik': 'src/adapters/qwik.ts',
  './persist': 'src/plugins/persist.ts',
  './popout': 'src/plugins/popout.ts',
  './gestures': 'src/plugins/gestures.ts',
  './devtools': 'src/plugins/devtools/index.ts',
  './chrome': 'src/plugins/chrome/index.ts',
  './winbox': 'src/plugins/winbox/index.ts',
  './dock': 'src/plugins/dock/index.ts',
  './elements': 'src/plugins/elements/index.ts',
  './elements/define': 'src/plugins/elements/define.ts',
  './ru': 'src/locales/ru.ts',
  './taskbar/define': 'src/plugins/taskbar/define.ts',
  './taskbar': 'src/plugins/taskbar/index.ts',
  './layouts': 'src/plugins/layouts/index.ts',
  './switcher': 'src/plugins/switcher/index.ts',
  './themes': 'src/themes/index.ts',
}

export function surface(): Record<string, string[]> {
  const read = ts.readConfigFile(`${root}tsconfig.json`, ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(read.config, ts.sys, root)
  const files = Object.values(ENTRIES).map((file) => `${root}${file}`)
  const program = ts.createProgram(files, { ...options, noEmit: true })
  const checker = program.getTypeChecker()
  const out: Record<string, string[]> = {}
  for (const [entry, file] of Object.entries(ENTRIES)) {
    const source = program.getSourceFile(`${root}${file}`)
    const module = source && checker.getSymbolAtLocation(source)
    out[entry] = (module ? checker.getExportsOfModule(module) : [])
      .map((symbol) => {
        const target =
          symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
        return `${symbol.name}: ${target.flags & ts.SymbolFlags.Value ? 'value' : 'type'}`
      })
      .sort()
  }
  return out
}
