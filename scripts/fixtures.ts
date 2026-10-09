// npm run fixtures: refresh src/kg/fixtures/ from a bdc-assist checkout (../bdc-assist, or
// BDC_ASSIST=<path>). kg/<keyword>.json: bdc-assist's tests/fixtures/kg/, copied as they are
// (what the done event carries for each stub keyword: { kg, sources }). graph/<keyword>.json:
// fromKgList of each, the client's merged graph; tests check fromKgList still makes it, so after
// a change to wire.ts, run this and review the diff.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { fromKgList } from '../src/kg/wire.ts'

const root = resolve(import.meta.dirname, '..')
const from = join(resolve(root, process.env.BDC_ASSIST ?? '../bdc-assist'), 'tests/fixtures/kg')
const out = join(root, 'src/kg/fixtures')

const files = readdirSync(from).filter((f) => f.endsWith('.json'))
if (!files.length) throw new Error(`no fixtures in ${from}`)
for (const dir of ['kg', 'graph']) {
  rmSync(join(out, dir), { recursive: true, force: true }) // a keyword bdc-assist dropped goes too
  mkdirSync(join(out, dir))
}
for (const f of files) {
  copyFileSync(join(from, f), join(out, 'kg', f))
  const graph = fromKgList(JSON.parse(readFileSync(join(from, f), 'utf8')).kg)
  writeFileSync(join(out, 'graph', f), JSON.stringify(graph, null, 1) + '\n')
  console.log(f)
}
