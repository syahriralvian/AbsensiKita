import "dotenv/config";
import "express-async-errors";
import express from "express";
import path from "path";
import rateLimit from "express-rate-limit";
import { setupTelegramBot, bot } from "./telegram";

// Impor modul yang sudah direfactor
import { n8nRouter } from "./src/routes/n8n";
import { wahaRouter } from "./src/routes/waha";
import { midtransRouter } from "./src/routes/midtrans";
import { admsRouter } from "./src/routes/adms";
import { geminiRouter } from "./src/routes/gemini";
import { mariadbRouter } from "./src/routes/mariadb";
import { setupCronJobs } from "./src/jobs/cron";

// Ensure startServer initializes the HTTP listener synchronously
async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const rawPort = process.env.PORT;
  const SERVER_PORT = 3000;

  // Start listening synchronously for Passenger
  const server = app.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${SERVER_PORT}`);
  });

  server.on('error', (e: any) => {
    console.error("Server listener error:", e);
  });

  // Setup Rate Limiting globally to protect against spam / ddos
  // In development, we skip/mock the rate limiting to avoid blocking developer previews and local polling
  const isProd = process.env.NODE_ENV === "production";
  const mockLimiter = (req: any, res: any, next: any) => next();

  const globalLimiter = isProd ? rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // extremely generous limit for production
    standardHeaders: true, 
    legacyHeaders: false,
    keyGenerator: (req) => {
      const forwarded = req.headers['x-forwarded-for'];
      const xForwardedFor = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return req.ip || xForwardedFor || req.socket?.remoteAddress || 'unknown';
    },
    message: JSON.stringify({ error: "Terlalu banyak request, coba lagi nanti." })
  }) : mockLimiter;
  app.use(globalLimiter);

  // Api specific rate limiter
  const apiLimiter = isProd ? rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 2000, // generous API call limit per minute
    keyGenerator: (req) => {
      const forwarded = req.headers['x-forwarded-for'];
      const xForwardedFor = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return req.ip || xForwardedFor || req.socket?.remoteAddress || 'unknown';
    },
    message: JSON.stringify({ error: "Terlalu banyak API call, tunggu sebentar." })
  }) : mockLimiter;
  app.use("/api/", apiLimiter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/iclock', express.text({ type: '*/*' }));
  app.use(express.text({ type: 'text/plain' }));
  
  // ==== Mendaftarkan Routing Modul ====
  app.use(n8nRouter);
  app.use(wahaRouter);
  app.use(midtransRouter);
  app.use(admsRouter);
  app.use(geminiRouter);
  app.use(mariadbRouter);

  app.all('/rest/v1/*', (req, res) => {
    res.status(200).json([]);
  });

  // Auto-seed demo data on startup
  import("./src/lib/demo.js").then((mod) => {
    mod.generateDemoDataIfNeeded().then(() => console.log("Demo data verified/seeded.")).catch(e => console.error("Demo seed error:", e));
  });

  // Telegram Webhook and Configuration

  if (bot) {
    // Endpoints for webhook (kept just in case they decide to hit it directly statically, but won't be registered)
    app.post('/api/telegram-webhook', async (req, res) => {
      try {
        console.log("🟢 TELEGRAM WEBHOOK RECEIVED:");
        
        let update = req.body;
        if (typeof update === 'string') {
          try { update = JSON.parse(update); } catch(e){}
        }

        // Just in case it's wrapped in another body
        if (update && typeof update.body === 'object') {
           update = update.body;
        } else if (update && typeof update.body === 'string') {
           try { update = JSON.parse(update.body); } catch(e){}
        }
        
        if (bot) {
          await bot.handleUpdate(update, res);
        }
        
        if (!res.headersSent) {
          res.status(200).send('OK');
        }
      } catch (err: any) {
        console.error("🔴 TELEGRAM WEBHOOK ERROR:", err.message);
        if (!res.headersSent) res.status(200).send('OK');
      }
    });
    
    if (process.env.USE_TELEGRAM_WEBHOOK === 'true') {
        let webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || "";
        if (webhookUrl) {
            try {
                if (!webhookUrl.startsWith('http')) {
                    webhookUrl = 'https://' + webhookUrl;
                }
                new URL(webhookUrl); // validasi URL agar tidak crash
                bot?.telegram.setWebhook(webhookUrl).then(() => {
                    console.log("🤖 Webhook successfully set to:", webhookUrl);
                }).catch(e => console.error("Cannot set webhook:", e.message));
            } catch (err: any) {
                console.error("Kesalahan format URL Telegram Webhook:", err.message);
                console.log("Mohon masukkan format URL yang benar (contoh: https://domain.com/webhook/...)");
            }
        } else {
             console.log("🤖 Telegram Webhook Mode active. Listening on /api/telegram-webhook. Defaulting to external webhook manager (e.g. n8n or cPanel).");
        }
    } else {
        // Force Long Polling for Telegram Bot
        bot?.telegram.deleteWebhook().then(() => {
            console.log("🤖 Webhook cleared. Starting Telegram Long Polling...");
            bot?.launch({ dropPendingUpdates: true }).catch(e => {
                if (e.message && e.message.includes("409")) return; // Ignore conflict errors in dev
                console.error("Telegram Polling launch error:", e.message);
            });
        }).catch(e => {
            console.error("Cannot delete webhook (might not be set):", e.message);
            bot?.launch({ dropPendingUpdates: true }).catch(e2 => {
                if (e2.message && e2.message.includes("409")) return; // Ignore conflict errors in dev
                console.error("Telegram Polling launch error:", e2.message);
            });
        });
    }
  }

  
  // Menjalankan Cron Jobs (Task Background)
  await setupCronJobs();

  const isDev = process.env.NODE_ENV !== 'production' && !(typeof __dirname !== 'undefined' && __dirname.includes('dist'));

  let viteServer: any = null;
  // Vite middleware for development
  if (isDev) {
    try {
      const { createServer: createViteServer } = await import("vite");
      viteServer = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
      });
      app.use(viteServer.middlewares);
    } catch (e: any) {
      console.warn("Vite not found or failed to load. Falling back to production static serve.");
      const distPath = (typeof __dirname !== "undefined" && __dirname.endsWith('dist')) ? __dirname : path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    // Determine the dist path properly based on whether we are already in dist or not
    const distPath = (typeof __dirname !== "undefined" && __dirname.endsWith('dist')) ? __dirname : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start Telegram Bot
  setupTelegramBot();
}

startServer();