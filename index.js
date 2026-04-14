require('dotenv').config();
const { 
    makeWASocket, useMultiFileAuthState, DisconnectReason, 
    fetchLatestBaileysVersion, downloadContentFromMessage 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const Groq = require("groq-sdk");
const express = require('express');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const fs = require('fs-extra');

const app = express();
const port = 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1. Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('\n=========================================');
        console.log('✅ DATABASE CONNECTED SUCCESSFULLY');
        console.log('=========================================\n');
    })
    .catch(err => console.error('❌ DB Error:', err.message));

async function startTara() {
    const { state, saveCreds } = await useMultiFileAuthState('tara_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["TARA AI", "Chrome", "1.0.0"],
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📢 SCAN THIS QR CODE TO ACTIVATE TARA AI:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(() => startTara(), 5000);
            }
        } else if (connection === 'open') {
            console.log('\n-----------------------------------------');
            console.log('🚀 TARA AI IS NOW ONLINE!');
            console.log('👨‍💻 Developed by Kalpa Tharaka');
            console.log('📡 Status: Ready to serve');
            console.log('-----------------------------------------\n');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        
        let caption = msg.message.imageMessage?.caption || "";
        let body = (type === 'conversation') ? msg.message.conversation : 
                   (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : caption;
        const lowerBody = body ? body.toLowerCase() : "";

        // --- 1. IDENTITY ---
        if (lowerBody.includes("who made you") || lowerBody.includes("haduwe") || lowerBody.includes("creator")) {
            return await sock.sendMessage(from, { 
                text: "I was developed by **Kalpa Tharaka**. He is my mastermind and creator! 👨‍💻✨" 
            });
        }

        // --- 2. AUTO STICKER MAKER (Background Fix) ---
        if (type === 'imageMessage' && !caption) {
            try {
                const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                
                const sticker = new Sticker(buffer, {
                    pack: 'TARA AI Bot',
                    author: 'Kalpa Tharaka',
                    type: StickerTypes.CROPPED, // Background ප්‍රශ්නය එනවා නම් CROPPED හෝ FULL පාවිච්චි කරන්න
                    quality: 100
                });
                return await sock.sendMessage(from, await sticker.toMessage());
            } catch (e) {
                console.log("Sticker Error");
            }
        }

        // --- 3. VIDEO DOWNLOADER ---
        if (body.includes('tiktok.com') || body.includes('instagram.com') || body.includes('facebook.com')) {
            await sock.sendMessage(from, { text: "⏳ වීඩියෝ එක බානවා මචං... පොඩ්ඩක් ඉන්න!" });
            try {
                const res = await axios.get(`https://api.vreden.my.id/api/downloadall?url=${encodeURIComponent(body)}`);
                const videoUrl = res.data.result.url || res.data.result.video;
                if (videoUrl) {
                    return await sock.sendMessage(from, { 
                        video: { url: videoUrl }, 
                        caption: "Done by TARA AI ✅\nDeveloper: Kalpa Tharaka" 
                    });
                }
            } catch (e) {
                await sock.sendMessage(from, { text: "❌ Downloader Busy!" });
            }
            return;
        }

        // --- 4. VOICE TO AI ---
        if (type === 'audioMessage') {
            try {
                const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                const tempFile = `./voice_${Date.now()}.ogg`;
                await fs.writeFile(tempFile, buffer);
                const transcription = await groq.audio.transcriptions.create({ file: fs.createReadStream(tempFile), model: "whisper-large-v3" });
                const aiRes = await groq.chat.completions.create({ messages: [{ role: "user", content: transcription.text }], model: "llama-3.3-70b-versatile" });
                await sock.sendMessage(from, { text: `🎤 *Heard:* ${transcription.text}\n\n${aiRes.choices[0].message.content}` });
                await fs.remove(tempFile);
            } catch (e) { console.log("Voice Error"); }
            return;
        }

        // --- 5. AI CHAT ---
        if (type !== 'imageMessage' && body.length > 1 && !body.startsWith('.')) {
            try {
                const aiRes = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are TARA AI, created by Kalpa Tharaka." },
                        { role: "user", content: body }
                    ],
                    model: "llama-3.3-70b-versatile",
                });
                await sock.sendMessage(from, { text: aiRes.choices[0].message.content });
            } catch (e) { console.log("AI Chat Error"); }
        }
    });
}

app.get('/', (req, res) => res.send('TARA AI Online!'));
app.listen(port);
startTara();
