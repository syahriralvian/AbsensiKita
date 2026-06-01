import 'dotenv/config';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
bot.telegram.getWebhookInfo().then(console.log).catch(console.error);
