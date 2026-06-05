# 🎤 MJ Adlib Bot

A Discord bot that joins a voice channel and randomly plays Michael Jackson adlibs on a random timer.

## Commands

| Command  | Description |
|----------|-------------|
| `!join`  | Bot joins your current voice channel and starts playing random adlibs |
| `!leave` | Bot leaves the voice channel |
| `!mj`    | Manually trigger a random adlib immediately |
| `!adlibs`| List all loaded adlib files |

## Setup

### 1. Prerequisites
- **Node.js v18+** — https://nodejs.org
- **FFmpeg** — handled automatically via `ffmpeg-static`

### 2. Create your Discord Bot
1. Go to https://discord.com/developers/applications
2. Click **New Application**, give it a name
3. Go to **Bot** tab → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**
5. Copy your bot **Token** (keep this secret!)
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Connect`, `Speak`, `Send Messages`, `Read Message History`
7. Use the generated URL to invite the bot to your server

### 3. Install dependencies
```bash
npm install
```

### 4. Configure the bot
```bash
cp .env.example .env
```
Edit `.env` and paste your bot token:
```
DISCORD_TOKEN=your_actual_token_here
```

### 5. Add your adlib audio files
Create an `adlibs/` folder in the project root and drop in your audio files:
```
adlibs/
  hee-hee.mp3
  shamone.mp3
  ow.mp3
  annie-are-you-ok.mp3
  ...
```
Supported formats: `.mp3`, `.ogg`, `.wav`, `.flac`

### 6. Run the bot
```bash
npm start
```

## Timing
By default the bot plays an adlib every **30 seconds to 5 minutes** (random). You can change this in `index.js`:
```js
const MIN_DELAY_MS = 30_000;   // 30 seconds
const MAX_DELAY_MS = 300_000;  // 5 minutes
```

## Troubleshooting

- **"No adlib files found"** — Make sure your `adlibs/` folder exists and has audio files in it
- **Bot joins but no audio** — Check that the bot has `Speak` permission in the voice channel
- **`sodium-native` install error** — Try `npm install --build-from-source` or install build tools (`npm install -g windows-build-tools` on Windows)
