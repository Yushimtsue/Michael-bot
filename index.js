const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── CONFIG ────────────────────────────────────────────────────────────────

const PREFIX = '!';

// Min/max delay (in ms) between random adlib plays
const MIN_DELAY_MS = 30_000;   // 30 seconds
const MAX_DELAY_MS = 300_000;  // 5 minutes

// Put your .mp3/.ogg adlib files in the ./adlibs/ folder
const ADLIBS_DIR = path.join(__dirname, 'adlibs');
const adlibFiles = getAdlibFiles();

// ─── STATE ─────────────────────────────────────────────────────────────────

// Map of guildId -> { connection, player, timeoutId }
const guildSessions = new Map();

// ─── HELPERS ───────────────────────────────────────────────────────────────

function getAdlibFiles() {
  if (!fs.existsSync(ADLIBS_DIR)) {
    console.error(`❌ Adlibs folder not found at: ${ADLIBS_DIR}`);
    return [];
  }
  return fs
    .readdirSync(ADLIBS_DIR)
    .filter((f) => /\.(mp3|ogg|wav|flac)$/i.test(f));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

function scheduleNextAdlib(guildId) {
  const session = guildSessions.get(guildId);
  if (!session) return;

  const delay = randomDelay();
  console.log(`⏱  [${guildId}] Next adlib in ${(delay / 1000).toFixed(1)}s`);

  session.timeoutId = setTimeout(() => {
    playAdlib(guildId);
  }, delay);
}

function playAdlib(guildId) {
  const session = guildSessions.get(guildId);
  if (!session) return;

  if (adlibFiles.length === 0) {
    console.warn('⚠️  No adlib files found in ./adlibs/');
    scheduleNextAdlib(guildId);
    return;
  }

  const chosen = pickRandom(adlibFiles);
  const filePath = path.join(ADLIBS_DIR, chosen);
  console.log(`🎤 [${guildId}] Playing: ${chosen}`);

  try {
    const ffmpegPath = require('ffmpeg-static');
    const { spawn } = require('child_process');
    const ffmpeg = spawn(ffmpegPath, [
      '-i', filePath,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ]);

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: require('@discordjs/voice').StreamType.Raw,
      inlineVolume: true,
    });
    resource.volume.setVolume(1);
    session.player.play(resource);
  } catch (err) {
    console.error('Error playing adlib:', err);
    scheduleNextAdlib(guildId);
  }
}

function stopSession(guildId) {
  const session = guildSessions.get(guildId);
  if (!session) return;

  clearTimeout(session.timeoutId);

  try {
    session.connection.destroy();
  } catch (_) {}

  guildSessions.delete(guildId);
  console.log(`👋 [${guildId}] Session ended.`);
}

// ─── COMMANDS ──────────────────────────────────────────────────────────────

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args[0].toLowerCase();

  // !join
  if (command === 'michael') {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('🚫 You need to be in a voice channel first!');
    }

    if (guildSessions.has(message.guild.id)) {
      return message.reply("I'm already in a voice channel! Use `!leave` first.");
    }

    if (adlibFiles.length === 0) {
      return message.reply(
        '⚠️ No adlib files found in the `./adlibs/` folder. Add some `.mp3` files and try again!'
      );
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    // When a track finishes, schedule the next one
    player.on(AudioPlayerStatus.Idle, () => {
      scheduleNextAdlib(message.guild.id);
    });

    player.on('error', (err) => {
      console.error('Player error:', err);
      scheduleNextAdlib(message.guild.id);
    });

    // Handle disconnects
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        stopSession(message.guild.id);
      }
    });

    guildSessions.set(message.guild.id, { connection, player, timeoutId: null });

    await message.reply(`✅ Joined **${voiceChannel.name}**! Hee-hee! 🕺`);
    console.log(`✅ [${message.guild.id}] Joined voice channel: ${voiceChannel.name}`);

    // Kick off the first adlib after a short intro delay
    const session = guildSessions.get(message.guild.id);
    session.timeoutId = setTimeout(() => playAdlib(message.guild.id), 3000);
  }

  // !leave
  else if (command === 'leave') {
    if (!guildSessions.has(message.guild.id)) {
      return message.reply("I'm not in a voice channel!");
    }
    stopSession(message.guild.id);
    message.reply('👋 Shamone! See ya later.');
  }

  // !mj  (manual trigger)
  else if (command === 'mj') {
    if (!guildSessions.has(message.guild.id)) {
      return message.reply("I'm not in a voice channel! Use `!join` first.");
    }
    const session = guildSessions.get(message.guild.id);
    clearTimeout(session.timeoutId); // cancel pending timer
    playAdlib(message.guild.id);
    message.reply('🎤 Hee-hee!');
  }

  // !adlibs  (list loaded files)
  else if (command === 'adlibs') {
    if (adlibFiles.length === 0) {
      return message.reply('No adlib files found in `./adlibs/`.');
    }
    message.reply(
      `🎵 **${adlibFiles.length} adlib(s) loaded:**\n${adlibFiles.map((f) => `• \`${f}\``).join('\n')}`
    );
  }
});

// ─── BOOT ──────────────────────────────────────────────────────────────────

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`📁 Adlibs folder: ${ADLIBS_DIR}`);
  console.log(`🎵 Adlibs found: ${adlibFiles.length}`);
});

client.login(process.env.DISCORD_TOKEN);
