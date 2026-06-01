import { Request, Response, Router } from "express";
import { callWahaApi, getWahaConfig } from "../utils/waha";

export const wahaRouter = Router();

// GET status
wahaRouter.get("/api/waha/session/status", async (req: Request, res: Response) => {
    try {
        const session = req.query.session as string;
        if (!session) {
            return res.status(400).send("Session required");
        }
        
        // GET /api/sessions
        const response = await callWahaApi(`/api/sessions?all=true`, "GET");
        if (!response.ok) {
            return res.status(response.status).send(await response.text());
        }
        const sessions = await response.json();
        const found = sessions.find((s: any) => s.name === session);
        
        if (found) {
            res.json(found);
        } else {
            res.status(404).json({ status: "STOPPED" });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// GET QR
wahaRouter.get("/api/waha/session/qr", async (req: Request, res: Response) => {
    try {
        const session = req.query.session as string;
        if (!session) {
            return res.status(400).send("Session required");
        }
        
        const response = await callWahaApi(`/api/${session}/auth/qr`, "GET");
        if (!response.ok) {
            return res.status(response.status).send(await response.text());
        }
        
        // If it's application/json, parse and return, else text
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ data: text });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST start
wahaRouter.post("/api/waha/session/start", async (req: Request, res: Response) => {
    try {
        const session = req.body.session;
        if (!session) return res.status(400).send("Session required");
        
        const response = await callWahaApi(`/api/sessions/start`, "POST", { name: session });
        const text = await response.text();
        if (!response.ok) {
            return res.status(response.status).send(text);
        }
        try { res.json(JSON.parse(text)); } catch { res.send(text); }
        
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST stop
wahaRouter.post("/api/waha/session/stop", async (req: Request, res: Response) => {
    try {
        const session = req.body.session;
        if (!session) return res.status(400).send("Session required");
        
        const response = await callWahaApi(`/api/sessions/stop`, "POST", { name: session });
        const text = await response.text();
        if (!response.ok) {
            return res.status(response.status).send(text);
        }
        try { res.json(JSON.parse(text)); } catch { res.send(text); }
        
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST logout
wahaRouter.post("/api/waha/session/logout", async (req: Request, res: Response) => {
    try {
        const session = req.body.session;
        if (!session) return res.status(400).send("Session required");
        
        const response = await callWahaApi(`/api/sessions/logout`, "POST", { name: session });
        const text = await response.text();
        if (!response.ok) {
            return res.status(response.status).send(text);
        }
        try { res.json(JSON.parse(text)); } catch { res.send(text); }
        
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST sendText
wahaRouter.post("/api/waha/sendText", async (req: Request, res: Response) => {
    try {
        const { session, chatId, text } = req.body;
        if (!session || !chatId || !text) return res.status(400).send("Missing parameters");
        
        const response = await callWahaApi(`/api/sendText`, "POST", { session, chatId, text });
        const resultText = await response.text();
        
        if (!response.ok) {
            return res.status(response.status).send(resultText);
        }
        
        try { res.json(JSON.parse(resultText)); } catch { res.send(resultText); }
        
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
