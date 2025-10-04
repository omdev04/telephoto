# 📸 TelegramPoto - Free Image CDN Using Telegram

![Node.js](https://img.shields.io/badge/Node.js-14%2B-green?logo=node.js)  
![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-blue?logo=telegram)  
![License](https://img.shields.io/badge/License-MIT-yellow.svg)  
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)  

**TelegramPoto** is a lightweight web application that turns **Telegram** into a free Content Delivery Network (CDN) for images.  
Upload images via a web interface — they get stored in a **private Telegram channel** and served through a clean CDN endpoint.

---

## 🚀 Features
- ✅ **Free Image Hosting** — Uses Telegram’s unlimited cloud storage.  
- ✅ **Simple Web Interface** — Drag & drop uploader with preview.  
- ✅ **CDN Endpoint** — Access images via `/cdn/:id`.  
- ✅ **Multiple Resolutions** — Original, Medium, and Small (`?size=small|medium`).  
- ✅ **Cache Optimized** — HTTP cache headers for faster loads.  
- ✅ **File Validation** — Supports only **PNG, JPG, JPEG**.  
- ✅ **Error Handling** — Clear user feedback & error messages.  

---

## 📦 Prerequisites
- Node.js (v14 or higher)  
- A Telegram account  
- A **Telegram Bot Token** from [@BotFather](https://t.me/botfather)  
- A private Telegram channel with your bot as **Administrator**  

---

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/telegrampoto.git
cd telegrampoto
````

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Telegram Bot & Channel

1. Create a bot via [@BotFather](https://t.me/botfather).
2. Save the **Bot Token**.
3. Create a **private Telegram channel**.
4. Add your bot as **Administrator**.
5. Get the **Channel ID**:

   * Forward any message from your channel to [@JsonDumpBot](https://t.me/JsonDumpBot).
   * Look for `forward_from_chat.id` (e.g., `-100xxxxxxxxxx`).

### 4. Configure Environment Variables

Copy `.env.example` → `.env` and edit:

```env
BOT_TOKEN=your_telegram_bot_token_from_botfather
CHANNEL_ID=-100xxxxxxxxxx
PORT=3000
```

### 5. Start the Server

```bash
npm start
```

👉 Open: `http://localhost:3000`

---

## 📤 Usage

### Uploading Images

1. Open `http://localhost:3000`
2. Drag & Drop or choose an image
3. Click **Upload**
4. Get preview + CDN links

### Serving Images

Base format:

```
http://localhost:3000/cdn/IMAGE_ID
```

Resized versions:

```
http://localhost:3000/cdn/IMAGE_ID?size=small
http://localhost:3000/cdn/IMAGE_ID?size=medium
```

### Example (HTML)

```html
<img src="http://localhost:3000/cdn/IMAGE_ID?size=medium" alt="My Image">
```

---

## 🌍 Deployment

### 🚀 One-Click Deploy (Heroku)

[![Deploy on Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

```bash
heroku login
heroku create your-app-name
heroku config:set BOT_TOKEN=your_telegram_bot_token
heroku config:set CHANNEL_ID=-100xxxxxxxxxx
git push heroku main
```

### 🟦 DigitalOcean App Platform

1. Connect GitHub repo → DigitalOcean App Platform
2. Add environment variables
3. Deploy

### 🐳 Docker

```bash
docker build -t telegrampoto .
docker run -p 3000:3000 --env-file .env telegrampoto
```

---

## ⚠️ Limitations

* Max file size: **20MB** (Telegram Bot API limit)
* Supports **PNG, JPG, JPEG** only
* No authentication (you can add middleware if needed)

---

## 📜 License

[MIT](LICENSE)

---

💡 Created by **[OM SHUKLA]** — PRs and contributions welcome! 🚀

```
