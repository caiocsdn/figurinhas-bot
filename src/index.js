import makeWASocket, {
  areJidsSameUser,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'
import P from 'pino'
import qrcode from 'qrcode-terminal'
import { rm } from 'node:fs/promises'
import { createSticker } from './sticker.js'

const logger = P({ level: 'silent' })
const AUTH_DIRECTORY = 'auth'
const COMMAND = /^!fig\s*$/i
const STARTED_AT_SECONDS = Math.floor(Date.now() / 1000)
const processedMessages = new Set()
let activeSocket = null
let reconnectTimer = null

function isRecentMessage(message) {
  const timestamp = Number(message.messageTimestamp || 0)
  // Alguns envios feitos pelo celular chegam como "append". Só aceitamos
  // mensagens da própria conta criadas após o início do bot, nunca o histórico.
  return message.key.fromMe && timestamp >= STARTED_AT_SECONDS - 10
}

function rememberMessage(message) {
  const id = message.key.id
  if (!id || processedMessages.has(id)) return false
  processedMessages.add(id)
  if (processedMessages.size > 500) processedMessages.delete(processedMessages.values().next().value)
  return true
}

function unwrapMessage(messageOrContent) {
  // Os eventos entregam um WAMessage ({ key, message }), enquanto mensagens
  // citadas já chegam como IMessage. Aceita os dois formatos.
  let current = messageOrContent?.message || messageOrContent
  while (current?.ephemeralMessage?.message || current?.viewOnceMessage?.message || current?.viewOnceMessageV2?.message) {
    current = current.ephemeralMessage?.message || current.viewOnceMessage?.message || current.viewOnceMessageV2?.message
  }
  return current
}

function getMedia(message) {
  const content = unwrapMessage(message)
  if (!content) return null
  if (content.imageMessage) return { type: 'image', node: content.imageMessage }
  if (content.videoMessage) return { type: 'video', node: content.videoMessage }
  // GIFs can arrive as a document rather than as a videoMessage.
  if (content.documentMessage?.mimetype?.startsWith('image/gif')) return { type: 'gif', node: content.documentMessage }
  return null
}

function getCommandText(message) {
  const content = unwrapMessage(message)
  return content?.conversation || content?.extendedTextMessage?.text || content?.imageMessage?.caption || content?.videoMessage?.caption || content?.documentMessage?.caption || ''
}

function quotedMediaMessage(message) {
  const context = unwrapMessage(message)?.extendedTextMessage?.contextInfo
  if (!context?.quotedMessage) return null
  return {
    key: {
      remoteJid: message.key.remoteJid,
      id: context.stanzaId,
      participant: context.participant,
      fromMe: false
    },
    message: context.quotedMessage
  }
}

function destinationJid(sock, message) {
  const remoteJid = message.key.remoteJid
  if (!remoteJid) return null
  const selfIds = [sock.user?.id, sock.user?.lid].filter(Boolean)
  const isSelfChat = message.key.fromMe && selfIds.some((id) => areJidsSameUser(remoteJid, id))
  return isSelfChat ? jidNormalizedUser(sock.user.id) : (message.key.remoteJidAlt || remoteJid)
}

async function handleMessage(sock, message) {
  if (!message.message || !COMMAND.test(getCommandText(message).trim())) return
  if (!rememberMessage(message)) return

  console.log(`Comando !fig detectado (${message.key.fromMe ? 'mensagem da conta conectada' : 'mensagem recebida'}). Processando mídia...`)
  const source = getMedia(message) ? message : quotedMediaMessage(message)
  const media = source && getMedia(source.message)
  const jid = destinationJid(sock, message)
  if (!jid) return

  if (!source || !media) {
    await sock.sendMessage(jid, { text: 'Envie uma imagem, vídeo ou GIF com !fig ou responda uma mídia usando !fig.' }, { quoted: message })
    return
  }

  try {
    const buffer = await downloadMediaMessage(source, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage })
    const sticker = await createSticker(buffer, media.type, media.node.mimetype)
    await sock.sendMessage(jid, { sticker }, { quoted: message })
    console.log('Figurinha enviada com sucesso.')
  } catch (error) {
    console.error('Erro ao criar figurinha:', error)
    await sock.sendMessage(jid, { text: 'Não foi possível criar a figurinha.' }, { quoted: message })
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY)
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    // O bot não precisa do histórico para converter novas mídias.
    shouldSyncHistoryMessage: () => false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }
  })
  activeSocket = sock

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nEscaneie o QR Code abaixo para conectar seu WhatsApp:\n')
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') console.log('WhatsApp conectado. Aguardando !fig...')
    if (connection === 'close') {
      // Eventos de sockets antigos não podem criar uma segunda reconexão.
      if (sock !== activeSocket || reconnectTimer) return
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const reason = lastDisconnect?.error?.message || 'motivo não informado'
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('A sessão foi desconectada. Gerando um novo QR Code...')
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          rm(AUTH_DIRECTORY, { recursive: true, force: true })
            .then(() => startBot())
            .catch((error) => console.error('Erro ao reiniciar a sessão:', error.message))
        }, 1500)
      } else {
        console.log(`Conexão encerrada (${statusCode ?? 'sem código'}: ${reason}). Reconectando em 3 segundos...`)
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          startBot().catch((error) => console.error('Erro ao reconectar:', error.message))
        }, 3000)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type, requestId }) => {
    // Ignora reenvios de placeholder, que não representam um comando novo.
    if (requestId) return
    if (type !== 'notify' && !messages.some(isRecentMessage)) return
    for (const message of messages) {
      if (type !== 'notify' && !isRecentMessage(message)) continue
      await handleMessage(sock, message)
    }
  })

  // Mensagens enviadas pelo celular principal podem ser sincronizadas como
  // update.message em vez de messages.upsert, principalmente em chats próprios.
  sock.ev.on('messages.update', async (updates) => {
    for (const { key, update } of updates) {
      if (!key.fromMe || !update.message) continue
      await handleMessage(sock, {
        key,
        message: update.message,
        messageTimestamp: Math.floor(Date.now() / 1000)
      })
    }
  })
}

startBot().catch((error) => {
  console.error('Não foi possível iniciar o bot:', error)
  process.exitCode = 1
})
