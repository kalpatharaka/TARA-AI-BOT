# 🚀 TARA AI - WhatsApp Bot

TARA AI is a multi-functional WhatsApp bot developed using **Node.js** and **Baileys**. It features an advanced AI chat system powered by **Groq (Llama 3)**, an automated sticker maker, and a video downloader for social media.

## ✨ Features
- **🤖 AI Chat:** Integrated with Groq SDK for lightning-fast AI responses.
- **🎙️ Voice to Text:** Transcribes voice notes and replies using AI.
- **🖼️ Auto Sticker:** Send any image without a caption to instantly create a sticker.
- **📥 Video Downloader:** Download videos from TikTok, Instagram, and Facebook.
- **⚡ Fast & Stable:** Reconnection logic to stay online 24/7.

## 🛠️ Tools & Technologies Used
* **Node.js** - Runtime environment.
* **Baileys** - WhatsApp Web API library.
* **Groq Cloud SDK** - Llama 3 AI processing.
* **MongoDB** - Database for session storage.
* **Axios** - API requests for downloading videos.
* **WA-Sticker-Formatter** - Image to sticker conversion.

## ⚙️ Installation Guide

Follow these steps to set up TARA AI on your local machine or server:

### 1. Prerequisites
Ensure you have **Node.js** (v16+) and **npm** installed.

### 2. Clone the Repository
```bash
git clone https://github.com/kalpatharaka/TARA-AI-BOT
cd TARA-AI-BOT
```

### 3. Install Dependencies
```Bash
npm install
```

### 4. Configure Environment Variables
Create a .env file in the root directory and add your credentials as shown below:(Note: Make sure you don't share your .env file with anyone. It is already added to .gitignore to keep your keys safe.)
```Bash
MONGODB_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
```


### 5. Run the Bot
```Bash
node index.js
```
After running, scan the QR code displayed in the terminal with your WhatsApp.

## 🤝 Contributing
Feel free to fork this repository and submit pull requests. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License
This project is licensed under the [MIT License](LICENSE).

‍💻 Developer Developed with ❤️ by Kalpa Tharaka.

⚠ Disclaimer: This bot is for educational purposes only. The developer is not responsible for any misuse. Please use it responsibly and follow WhatsApp's Terms of Service.
