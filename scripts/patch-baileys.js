import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Baileys rc14 considera a string "0" verdadeira ao ler o atributo `offline`.
// Isso prende mensagens novas no processador offline e impede messages.upsert.
// O patch é reaplicado após todo npm install e pode ser removido quando a
// correção for publicada oficialmente.
const file = path.resolve('node_modules/@whiskeysockets/baileys/lib/Socket/messages-recv.js')
let source = await readFile(file, 'utf8')

const replacements = [
  ["node.attrs.offline ? 'append' : 'notify'", "node.attrs.offline === '1' ? 'append' : 'notify'"],
  ['offline: !!attrs.offline', "offline: attrs.offline === '1'"],
  ['const isOffline = !!node.attrs.offline;', "const isOffline = node.attrs.offline === '1';"]
]

let changes = 0
for (const [before, after] of replacements) {
  if (source.includes(before)) {
    source = source.replace(before, after)
    changes += 1
  }
}

if (changes > 0) {
  await writeFile(file, source, 'utf8')
  console.log(`Patch de recebimento do Baileys aplicado (${changes} ajustes).`)
} else if (!replacements.every(([, after]) => source.includes(after))) {
  throw new Error('A versão do Baileys mudou e o patch de recebimento precisa ser revisado.')
}

// A dependência libsignal antiga usada pelo Baileys imprime o objeto completo da
// sessão (inclusive chaves) com console.info. Isso é desnecessário e inseguro.
const signalFile = path.resolve('node_modules/libsignal/src/session_record.js')
let signalSource = await readFile(signalFile, 'utf8')
const noisyLog = 'console.info("Closing session:", session);'
if (signalSource.includes(noisyLog)) {
  signalSource = signalSource.replace(noisyLog, '// Log de sessão removido pelo wa-sticker-bot.')
  await writeFile(signalFile, signalSource, 'utf8')
  console.log('Log inseguro de sessão do libsignal desativado.')
}
