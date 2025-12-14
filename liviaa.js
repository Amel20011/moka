const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
    makeInMemoryStore,
    proto
} = require('@whiskeysockets/baileys')

const { Boom } = require('@hapi/boom')
const fs = require('fs')
const P = require('pino')
const qrcode = require('qrcode-terminal')

// Konfigurasi
const ownerNumber = '628123456789@s.whatsapp.net' // GANTI dengan nomor owner Anda
const sessionName = 'liviaa_session'
const prefix = '' // Tidak menggunakan prefix, sesuai menu

// Store untuk menyimpan pesan
const store = makeInMemoryStore({ logger: P().child({ level: 'silent', stream: 'store' }) })

// Fungsi utama untuk menjalankan bot
async function startBot() {
    console.log(`\x1b[33m${'Mengambil versi terbaru Baileys...'}\x1b[0m`)
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`\x1b[32mMenggunakan Baileys versi ${version}, terbaru: ${isLatest}\x1b[0m`)
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionName)
    
    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.ubuntu('Liviaa Bot'),
        auth: state,
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id)
                return msg.message || undefined
            }
            return {
                conversation: "Halo, Saya Liviaa Bot!"
            }
        }
    })

    store.bind(sock.ev)

    // Pairing Code
    if (!sock.authState.creds.registered) {
        const question = `\x1b[32mMasukkan nomor WhatsApp Anda, contoh: 628xxxxxxxxxx\x1b[0m`
        const number = await new Promise(resolve => {
            process.stdout.write(question)
            process.stdin.once('data', data => resolve(data.toString().trim()))
        })
        
        if (!number) {
            console.log('\x1b[31mNomor tidak boleh kosong!\x1b[0m')
            process.exit(1)
        }

        const code = await sock.requestPairingCode(number)
        console.log(`\x1b[34mKode Pairing Anda: ${code}\x1b[0m`)
    }

    // Event listener untuk koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Koneksi terputus karena ', lastDisconnect.error, ', reconnect lagi ', shouldReconnect)
            if (shouldReconnect) {
                startBot()
            }
        } else if (connection === 'open') {
            console.log('\x1b[32mBot terhubung!\x1b[0m')
        }
    })

    // Event listener untuk credential update
    sock.ev.on('creds.update', saveCreds)

    // Event listener untuk pesan masuk
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        const m = messages[0]

        if (!m.message) return
        if (m.key.fromMe) return
        if (m.key.remoteJid === 'status@broadcast') return

        const messageType = Object.keys(m.message)[0]
        const textMessage = m.message.conversation || m.message.extendedTextMessage?.text || ''

        // Mendapatkan info pengirim dan grup
        const sender = m.key.remoteJid
        const senderName = m.pushName
        const isGroup = sender.endsWith('@g.us')
        const groupMetadata = isGroup ? await sock.groupMetadata(sender) : {}
        const groupAdmins = isGroup ? groupMetadata.participants.filter(p => p.admin).map(p => p.id) : []
        const isOwner = sender === ownerNumber
        const isAdmin = isGroup ? groupAdmins.includes(sender) : false

        // Fungsi untuk membalas pesan
        const reply = async (text, options = {}) => {
            await sock.sendMessage(sender, { text, ...options }, { quoted: m })
        }

        // Fungsi untuk mengirim pesan dengan tombol
        const sendButton = async (id, text, footer, buttons) => {
            const buttonMessage = {
                text: text,
                footer: footer,
                buttons: buttons,
                headerType: 1
            }
            await sock.sendMessage(id, buttonMessage)
        }

        // --- LOGIKA BOT ---

        // Pesan Selamat Datang untuk Member Baru
        if (messageType === 'protocolMessage' && m.message.protocolMessage.type === proto.Message.ProtocolMessage.Type.GROUP_PARTICIPANT_ADD) {
            const newMembers = m.message.protocolMessage.participantIds
            for (let jid of newMembers) {
                const welcomeText = `✨🌷 Hiii~ Selamat Datang 💗🌹\n\nHii Aku *Liviaa* ꨄ︎\nHalo @${jid.split('@')[0]} 👋\nSelamat bergabung di grup ini ya ✨\n\nSemoga betah & nyaman di sini 🌷\nJangan lupa daftar dulu biar bisa akses fitur bot 💗\n\nKlik tombol di bawah ya`
                const buttons = [
                    { buttonId: 'owner', buttonText: { displayText: 'Owner' }, type: 1 },
                    { buttonId: 'daftar', buttonText: { displayText: 'Daftar' }, type: 1 }
                ]
                await sendButton(sender, welcomeText, "✨ Liviaa Bot ✨", buttons)
            }
        }

        // Handler untuk Tombol yang Ditekan
        if (m.message.buttonsResponseMessage) {
            const clickedButtonId = m.message.buttonsResponseMessage.selectedButtonId
            if (clickedButtonId === 'owner') {
                await sock.sendContact(sender, [ownerNumber.split('@')[0]], senderName)
            } else if (clickedButtonId === 'daftar') {
                // Logika pendaftaran sederhana
                // Anda bisa menambahkan penyimpanan ke file atau database di sini
                await reply(`✅ Terima kasih sudah mendaftar, @${sender.split('@')[0]}! Sekarang kamu bisa menggunakan fitur-fitur bot.`, { mentions: [sender] })
            }
        }

        // Perintah Menu
        const command = textMessage.toLowerCase().trim()

        if (command === 'menu') {
            const menuText = `✨🌷 L I V I A A   B O T 🌷✨
ꨄ︎ Simple • Cute • Aesthetic ꨄ︎

𝜗ৎ 𑣲 .ᐟ.ᐟ ʚɞ ˙𐃷˙ ꨄ︎ .☘︎ ݁˖

💗 MENU UTAMA
𝜗ৎ menu
𑣲 Menampilkan semua menu

🌷 MENU GRUP
𝜗ৎ menugrup
𑣲 Welcome & Goodbye
𑣲 Anti Link
𑣲 Tag All

🌹 MENU OWNER
𝜗ৎ menuowner
𑣲 Broadcast
𑣲 Add / Kick Member

🌸 MENU ADMIN
𝜗ৎ menuadmin
𑣲 Set Welcome
𑣲 Set Rules

🌼 MENU DAFTAR
𝜗ৎ daftar
𑣲 Pendaftaran Member

ꨄ︎ ʚɞ ˙𐃷˙ .☘︎ ݁˖`
            await reply(menuText)
        } else if (command === 'menugrup') {
            const menuText = `🌷 MENU GRUP

𝜗ৎ welcome
𑣲 Aktifkan/Nonaktifkan welcome

𝜗ৎ antilink
𑣲 Aktifkan/Nonaktifkan antilink

𝜗ৎ tagall
𑣲 Mention semua member`
            await reply(menuText)
        } else if (command === 'menuowner') {
            if (!isOwner) return reply('Perintah ini hanya bisa digunakan oleh Owner!')
            const menuText = `🌹 MENU OWNER

𝜗ৎ bc <teks>
𑣲 Broadcast ke semua chat

𝜗ৎ add <628xx>
𑣲 Tambah member ke grup

𝜗ৎ kick @tag
𑣲 Kick member dari grup`
            await reply(menuText)
        } else if (command === 'menuadmin') {
            if (!isAdmin && !isOwner) return reply('Perintah ini hanya bisa digunakan oleh Admin!')
            const menuText = `🌸 MENU ADMIN

𝜗ৎ setwelcome <teks>
𑣲 Ubah pesan welcome

𝜗ৎ setrules <teks>
𑣲 Ubah aturan grup`
            await reply(menuText)
        } else if (command === 'daftar') {
            // Logika pendaftaran sama seperti saat tombol ditekan
            await reply(`✅ Terima kasih sudah mendaftar, @${sender.split('@')[0]}! Sekarang kamu bisa menggunakan fitur-fitur bot.`, { mentions: [sender] })
        }
        
        // Contoh implementasi fitur lainnya (placeholder)
        if (command === 'tagall' && isGroup) {
            if (!isAdmin && !isOwner) return reply('Perintah ini hanya bisa digunakan oleh Admin!')
            let teks = `📢 *Pesan dari @${sender.split('@')[0]}*\n\n`
            for (let mem of groupMetadata.participants) {
                teks += `@${mem.id.split('@')[0]} `
            }
            await sock.sendMessage(sender, { text: teks, mentions: groupMetadata.participants.map(a => a.id) })
        }
    })
}

// Jalankan bot
startBot()
