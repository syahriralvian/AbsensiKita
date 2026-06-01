import 'dotenv/config';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
bot.telegram.getUpdates(0, 10, 0, []).then(updates => {
  console.log("Updates:", JSON.stringify(updates));
  process.exit(0);
}).catch(console.error);
