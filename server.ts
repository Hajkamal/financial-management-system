import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini helper with resilient multi-model fallback
const getAIClient = () => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// POST /api/gemini/analyze
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { prompt, systemContext, history } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'کلید دسترسی هوش مصنوعی (GEMINI_API_KEY) در سرور تنظیم نشده است.',
      });
    }

    const systemInstruction = `شما «دستیار هوشمند مالی و تحلیل‌گر ارشد شرکت آینده نگاران خلاق» هستید.
دستورالعمل‌های حیاتی:
۱. تحلیل دقیق و اختصاصی بر اساس پرسش مشخص کاربر. به هیچ عنوان پاسخ کلی، تکراری یا قالب از پیش آماده ارائه ندهید.
۲. اگر کاربر درباره پرسنل یا حقوق پرسید، منحصراً روی اطلاعات حقوق، پرسنل و دستمزد متمرکز شوید.
۳. اگر کاربر درباره وام، تسهیلات یا اقساط پرسید، منحصراً وضعیت تسهیلات، مانده بدهی و اقساط ماهانه را تحلیل کنید.
۴. اگر کاربر درباره ماه مشخصی (مثلاً فروردین یا اردیبهشت) یا روند ماه‌ها پرسید، اعداد و تراز دقیق همان ماه را تحلیل کنید.
۵. اگر کاربر درباره کاهش هزینه‌ها پرسید، سرفصل‌های پرهزینه را شناسایی کرده و راهکارهای عملیاتی ارائه دهید.
۶. اگر کاربر درباره درآمدهای پلتفرم باسینا پرسید، سرفصل‌های فروش باسینا، نوبت‌دهی آنلاین، تریاژ هوش مصنوعی و اشتراک را تفکیک کنید.
۷. ارقام را با ذکر واحد (ریال / تومان) و با فرمت تفکیک‌شده و فارسی نمایش دهید.
۸. لحن پاسخ‌ها حرفه‌ای، محترمانه، ساختاریافته (با استفاده از مارک‌داون، بولیت‌ها و عناوین مجزا) باشد.

داده‌های مالی واقعی شرکت آینده نگاران خلاق (سال ۱۴۰۵):
${systemContext || 'اطلاعاتی ارائه نشده است.'}
`;

    // Cascade of available models in case of temporary 503/429 spikes
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
    ];

    // Format conversation history for Gemini SDK if provided
    let contents: any = prompt;
    if (Array.isArray(history) && history.length > 0) {
      const formattedHistory = history
        .filter((msg: any) => msg && msg.text && msg.sender)
        .slice(-6) // recent turns
        .map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        }));
      contents = [...formattedHistory, { role: 'user', parts: [{ text: prompt }] }];
    }

    let lastError: any = null;
    let generatedText: string | null = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.5,
          },
        });

        if (response && response.text) {
          generatedText = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} returned error:`, err?.status || err?.message || err);
        // Continue to next model in cascade
      }
    }

    if (generatedText) {
      return res.json({ text: generatedText });
    }

    throw lastError || new Error('خطا در پردازش هوش مصنوعی با تمامی مدل‌ها');
  } catch (err: any) {
    console.error('Gemini API Error in /api/gemini/analyze:', err);
    return res.status(500).json({
      error: err.message || 'خطا در ارتباط با هوش مصنوعی',
    });
  }
});

// Vite middleware or static serving
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
