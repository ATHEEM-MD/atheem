import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore 
} from '@whiskeysockets/baileys';
import Pino from 'pino';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';

export async function connect() {
  // Sehemu ya kuhifadhi sessions
  const { state, saveCreds } = await useMultiFileAuthState('./atheem-sessions');
  const { version } = await fetchLatestBaileysVersion();

  // Socket ya WhatsApp
  const sock = makeWASocket({
    version,
    logger: Pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: 'silent' })),
    },
    browser: ['ATHEEM BOT','Chrome','120'], // 👈 Imebadilishwa iwe yako
  });

  // Save credentials
  sock.ev.on('creds.update', saveCreds);

  // Connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Scan QR above or wait for Pairing Code...');
    }

    if (update.pairingCode) {
      console.log('🔑 Your Pairing Code:', update.pairingCode);
      console.log('👉 Open WhatsApp > Linked Devices > Pair with code');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) connect();
    } else if (connection === 'open') {
      console.log('✅ ATHEEM BOT Connected Successfully!');
    }
  });

  // Pairing Code Mode
  if (!state.creds.registered) {
    const phoneNumber = process.env.NUM || '';
    if (!phoneNumber) {
      console.log('⚠️ To use pairing code, run:');
      console.log('NUM=2557XXXXXXXX node index.js'); // 👈 Number yako Tanzania
    } else {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('🔑 Your Pairing Code:', code);
      console.log('👉 Open WhatsApp > Linked Devices > Pair with code');
    }
  }

  return sock;
}
