import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore 
} from '@whiskeysockets/baileys';
import Pino from 'pino';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessions');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    logger: Pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: 'silent' })),
    },
    browser: ['ATHEEM-MD','Chrome','120'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, pairingCode } = update;

    if (qr) {
      console.log('📱 Scan this QR to login:');
    }

    if (pairingCode) {
      console.log('🔑 Pairing Code:', pairingCode);
      console.log('👉 Open WhatsApp > Linked Devices > Pair with code');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log("❌ Connection closed. Reconnecting...", shouldReconnect);
      if (shouldReconnect) connect();
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
    }
  });

  // If no creds yet, request a pairing code instead of QR
  if (!state.creds.registered) {
    const phoneNumber = process.env.NUM || '';
    if (!phoneNumber) {
      console.log('⚠️ To use pairing code, set env variable: NUM=2557XXXXXXXX');
    } else {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('🔑 Pairing Code:', code);
      console.log('👉 Open WhatsApp > Linked Devices > Pair with code');
    }
  }

  return sock;
}

// start bot
connect().catch(err => console.error("❌ Error:", err));

// keep process alive on Render
setInterval(() => {}, 1000 * 60 * 60);
