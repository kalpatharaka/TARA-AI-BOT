require('dotenv').config();
const { 
    default: makeWASocket, useMultiFileAuthState, DisconnectReason, 
    fetchLatestBaileysVersion, downloadContentFromMessage 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const Groq = require("groq-sdk");
const fs = require('fs-extra');
const chalk = require('chalk');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const WEATHER_API_KEY = "16ff0eb1455de600d9808694a68b2f7e";

// 1. Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log(chalk.green.bold('\n✅ DATABASE CONNECTED')))
    .catch(err => console.error(chalk.red('❌ DB Error:'), err.message));

const chatSchema = new mongoose.Schema({ 
    userId: String, 
    userFacts: [String], 
    messages: [{ role: String, content: String }] 
});
const Chat = mongoose.model('Chat', chatSchema);

async function startTara() {
    const { state, saveCreds } = await useMultiFileAuthState('tara_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version, auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Powered by TARA Group", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        
        if (connection === 'open') {
            console.log('\n' + chalk.cyan.bold('-----------------------------------------'));
            console.log(chalk.white.bold('🚀 TARA AI IS NOW ONLINE!'));
            console.log(chalk.yellow.bold('👨‍💻 Developed by Kalpa Tharaka'));
            console.log(chalk.green.bold('📡 Status: Ready to serve'));
            console.log(chalk.cyan.bold('-----------------------------------------\n'));
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startTara();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        let userInput = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // --- 1. VOICE RECOGNITION ---
        if (type === 'audioMessage') {
            try {
                const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                const tempFile = `./voice_${Date.now()}.ogg`;
                await fs.writeFile(tempFile, buffer);
                const transcription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(tempFile),
                    model: "whisper-large-v3"
                });
                userInput = transcription.text;
                await fs.remove(tempFile);
            } catch (e) { console.log("Voice Error"); }
        }

        // --- 2. PHOTO TO STICKER ---
        if (type === 'imageMessage') {
            try {
                const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                const sticker = new Sticker(buffer, { 
                    pack: 'TARA AI Bot', 
                    author: 'Kalpa Tharaka', 
                    type: StickerTypes.FULL, 
                    quality: 70 
                });
                return await sock.sendMessage(from, { sticker: await sticker.toBuffer() });
            } catch (e) { console.log("Sticker Error"); }
        }

        // --- 3. DYNAMIC WELCOME ---
        let userChat = await Chat.findOne({ userId: from });
        if (!userChat && userInput) {
            userChat = new Chat({ userId: from, messages: [], userFacts: [] });
            await sock.sendMessage(from, { text: "Hello! I am TARA AI. How can I help you today?" });
        }

        if (!userInput) return;

        // --- 4. CLEAR CHAT ---
        if (userInput.toLowerCase().trim() === 'clear chat') {
            await Chat.deleteOne({ userId: from });
            return await sock.sendMessage(from, { text: "✅ Memory wiped, Machan! Fresh start." });
        }

        // --- 5. PRECISE REMINDER (Language Based) ---
        const timeMatch = userInput.toLowerCase().match(/(\d+)\s*(minute|minutes|min|vunadi|විනාඩි)/);
        if ((userInput.toLowerCase().includes('remind') || userInput.toLowerCase().includes('මතක්')) && timeMatch) {
            const mins = parseInt(timeMatch[1]);
            const isSinhala = /[\u0D80-\u0DFF]/.test(userInput);
            
            const confirmMsg = isSinhala ? `✅ හරි මචං, මම විනාඩි ${mins} කින් මතක් කරන්නම්.` : `✅ Okay Machan, I'll remind you in ${mins} minutes.`;
            await sock.sendMessage(from, { text: confirmMsg });

            setTimeout(async () => {
                const alertMsg = isSinhala ? `🔔 *REMINDER:* මචං ඔන්න වෙලාව හරි: *${userInput.replace(/මතක් කරන්න|මතක් කරපන්/gi, "").trim()}*` : `🔔 *REMINDER:* Machan, time for: *${userInput.replace(/remind me to|remind me/gi, "").trim()}*`;
                await sock.sendMessage(from, { text: alertMsg });
            }, mins * 60000);
            return;
        }

        // --- 6. WEATHER LOGIC ---
        const weatherKeywords = ['weather', 'කාලගුණය', 'kaalaguna', 'wether'];
        if (weatherKeywords.some(k => userInput.toLowerCase().includes(k))) {
            const city = userInput.split(' ').pop();
            if (city && city.length > 2 && !weatherKeywords.includes(city.toLowerCase())) {
                try {
                    const wRes = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
                    return await sock.sendMessage(from, { text: `🌤️ *Weather in ${wRes.data.name}:* ${wRes.data.main.temp}°C, ${wRes.data.weather[0].description}.` });
                } catch (e) {}
            }
        }

        // --- 7. ADVANCED AI CHAT (Self-Learning & Identity) ---
        try {
            const history = userChat.messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
            const facts = userChat.userFacts.slice(-5).join(" | ");

            const systemPrompt = `You are TARA AI, powered by TARA Group.
            - IDENTITY: If anyone asks (in any language) who created/made/developed you, ALWAYS say: "I was developed by *Kalpa Tharaka*. He is my mastermind and developer! 👨‍💻✨"
            - LANGUAGE: Automatically detect and adapt to the user's language (Sinhala, English, Tamil, etc.).
            - TONE: Use a friendly "Machan" style for Sinhala.
            - SELF-LEARNING: Use these facts about the user to personalize: [${facts}].
            - NEVER use "Malli" or "Aiya".`;

            let aiResponse;
            try {
                const completion = await groq.chat.completions.create({
                    messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: userInput }],
                    model: "llama-3.3-70b-versatile"
                });
                aiResponse = completion.choices[0].message.content;
            } catch (err) {
                // Connection/Rate Limit අවුලකදී මේ මැසේජ් එක යනවා
                console.log("Server Error Handling...");
                return await sock.sendMessage(from, { text: "⚠️ I am getting new updates please try in a moment" });
            }

            if (userInput.length > 5 && (userInput.toLowerCase().includes("මම") || userInput.toLowerCase().includes("my") || userInput.toLowerCase().includes("නම"))) {
                userChat.userFacts.push(userInput);
            }

            userChat.messages.push({ role: "user", content: userInput }, { role: "assistant", content: aiResponse });
            await userChat.save();
            await sock.sendMessage(from, { text: aiResponse });

        } catch (e) { 
            console.log("AI Chat Error");
            await sock.sendMessage(from, { text: "⚠️ I am getting new updates please try in a moment" });
        }
    });
}

startTara();
