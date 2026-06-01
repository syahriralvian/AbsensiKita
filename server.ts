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
import { setupCronJobs } from "./src/jobs/cron";

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = Number(process.env.PORT) || 3000;

  // Setup Rate Limiting globally to protect against spam / ddos
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    standardHeaders: true, 
    legacyHeaders: false,
    message: "Terlalu banyak request, coba lagi nanti."
  });
  app.use(globalLimiter);

  // Api specific rate limiter
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200,
    message: "Terlalu banyak API call, tunggu sebentar."
  });
  app.use("/api/", apiLimiter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/iclock', express.text({ type: '*/*' }));
  app.use(express.text({ type: 'text/plain' }));
  app.use(express.text({ type: 'application/json' }));
  app.use(express.text({ type: 'application/octet-stream' }));



  // ==== Mendaftarkan Routing Modul ====
  app.use(n8nRouter);
  app.use(wahaRouter);
  app.use(midtransRouter);
  app.use(admsRouter);
  app.use(geminiRouter);
  
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

  
  // Menjalankan Cron Jobs (Task Background)
  await setupCronJobs();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      
      setTimeout(() => { server.close(); server.listen(PORT); }, 1000);
    } else { console.error(e); }
  });

  // Start Telegram Bot
  setupTelegramBot();
}

startServer();