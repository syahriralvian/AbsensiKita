import { Request, Response, Router } from "express";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const midtransRouter = Router();

midtransRouter.get("/api/midtrans/config", (req: Request, res: Response) => {
  res.json({ clientKey: process.env.VITE_MIDTRANS_CLIENT_KEY || process.env.MIDTRANS_CLIENT_KEY || "" });
});

midtransRouter.post("/api/midtrans/webhook", async (req: Request, res: Response) => {
  try {
    const notification = req.body;
    if (!notification || !notification.transaction_status) {
      console.warn("Midtrans webhook completed with no transaction_status, possibly a test:", notification);
      return res.status(200).json({ message: "Test or invalid payload received successfully" });
    }

    const { order_id, transaction_status, gross_amount, signature_key, status_code } = notification;

    if (order_id && order_id.toString().includes("payment_notif_test")) {
       console.log("Midtrans test notification received:", order_id);
       return res.status(200).json({ status: "ok", message: "Test successful" });
    }

    const serverKey = process.env.VITE_MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY;
    if (serverKey) {
       const rawString = `${order_id}${status_code}${gross_amount}${serverKey}`;
       const hashed = crypto.createHash('sha512').update(rawString).digest('hex');
       if (hashed !== signature_key) {
         console.warn("Invalid Midtrans signature:", notification);
         return res.status(403).json({ error: "Invalid signature" });
       }
    }

    let nextStatus = "PENDING";
    if (transaction_status === "capture" || transaction_status === "settlement") {
      nextStatus = "SETTLED";
    } else if (transaction_status === "deny" || transaction_status === "cancel" || transaction_status === "expire") {
      nextStatus = "EXPIRED";
    } else if (transaction_status === "pending") {
      nextStatus = "PENDING";
    }

    if (nextStatus === "SETTLED" && supabase) {
      // 1. Dapatkan detail riwayat
      const { data: billData } = await supabase
        .from('billing_history')
        .select('*')
        .eq('id', order_id)
        .single();
      
      if (billData) {
         // Update billing history
         await supabase
           .from('billing_history')
           .update({ payment_status: nextStatus })
           .eq('id', order_id);

         // Tentukan apakah paketnya Standart atau Premium
         // Kita bisa estimasi dari price/employee atau anggap saja kita set melalui item_details
         // Namun dari gross_amount kita bisa estimasi jika per employee
         // Lebih amannya kita bisa cek dari gross_amount dibagi employee...
         // Untuk saat ini, asumsikan jika nilainya lebih dari Rp 10.000 (atau kelipatan) = Premium
         // Asumsi total harga: employee_count * price + ppn 12%
         const perEmployeeAmount = Number(billData.total_amount) / billData.employee_count;
         const isPremium = perEmployeeAmount > 6000; // Standart = 5000+ppn, Premium = 10000+ppn

         // Update companies tabel
         await supabase
           .from('companies')
           .update({ subscription_plan: isPremium ? 'Premium' : 'Standart' })
           .eq('company_id', billData.company_id);
      }
    } else if (supabase) {
       await supabase
         .from('billing_history')
         .update({ payment_status: nextStatus })
         .eq('id', order_id);
    }
    
    return res.status(200).json({ status: "ok" });
  } catch (error: any) {
    console.error("Webhook midtrans error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});


midtransRouter.post("/api/midtrans/token", async (req: Request, res: Response) => {
  try {
    const { orderId, amount, planName, customerDetails } = req.body;
    
    if (!orderId || !amount) {
      return res.status(400).json({ error: "orderId and amount are required." });
    }

    let isProd = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const tempKey = process.env.VITE_MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY;
    if (tempKey && !tempKey.startsWith('SB-')) {
       isProd = true;
    }
    const serverKey = process.env.VITE_MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY;
    
    if (!serverKey) {
      console.error("MIDTRANS_SERVER_KEY is not defined in env");
      return res.status(500).json({ error: "Konfigurasi Midtrans Server Key belum diatur di server." });
    }

    const apiUrl = isProd 
       ? "https://app.midtrans.com/snap/v1/transactions" 
       : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const authString = Buffer.from(serverKey + ":").toString("base64");

    const payload = {
      transaction_details: {
        order_id: String(orderId),
        gross_amount: Math.round(Number(amount)),
      },
      customer_details: {
        first_name: customerDetails?.name || "Customer",
        email: customerDetails?.email || "customer@example.com",
        phone: customerDetails?.phone || "",
      },
      item_details: planName ? [{
         id: "PLAN-SUB",
         price: Math.round(Number(amount)),
         quantity: 1,
         name: planName
      }] : undefined
    };

    const midtransRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Basic " + authString
      },
      body: JSON.stringify(payload)
    });

    if (!midtransRes.ok) {
       const err = await midtransRes.text();
       console.error("Midtrans Error:", err, "Payload:", payload);
       
       let parsedErr = "Gagal dari Midtrans API.";
       try {
           const parsed = JSON.parse(err);
           if (parsed.error_messages) parsedErr = parsed.error_messages.join(", ");
       } catch (e) {}

       return res.status(midtransRes.status).json({ error: `Midtrans: ${parsedErr}` });
    }

    const data = await midtransRes.json();
    return res.json({ token: data.token, redirect_url: data.redirect_url });

  } catch (error: any) {
    console.error("Token error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});


