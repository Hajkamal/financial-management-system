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

// Initialize Gemini on the server side
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// POST /api/gemini/analyze
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { prompt, systemContext } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'کلید دسترسی هوش مصنوعی (GEMINI_API_KEY) در سرور تنظیم نشده است.',
      });
    }

    const systemInstruction = `شما «دستیار هوشمند مالی و تحلیل‌گر ارشد شرکت آینده نگاران خلاق» هستید.
وظیفه شما:
۱. تحلیل و بررسی جامع وضعیت مالی، درآمدها، هزینه‌ها، تراز نقدینگی و جریان وجوه نقد سال ۱۴۰۵ شرکت.
۲. ارائه گزارش‌های دقیق، خلاصه وضعیت اجرایی، پاسخ به پرسش‌های کاربر با آمار و ارقام مستند بر اساس داده‌های مالی ارائه شده.
۳. شناسایی فرصت‌های صرفه‌جویی و کاهش هزینه‌ها (به‌ویژه در بخش‌های سرور، پیامک، کارمزدها و هزینه‌های جاری).
۴. تحلیل وضعیت حقوق و دستمزد پرسنل، بازپرداخت اقساط تسهیلات و موجودی حساب‌های فعال بانکی شرکت.
۵. لحن پاسخ‌ها باید کاملاً فارسی، حرفه‌ای، محترمانه، ساختاریافته با قالب‌بندی مرتب (عناوین با #، بولیت‌ها، نکات کلیدی و جداکننده هزارگان اعداد) باشد.
۶. همیشه مشخص کنید که مبالغ بر حسب ریال یا تومان برآورد شده‌اند.

اطلاعات زنده مالی شرکت آینده نگاران خلاق در دسترس شما:
${systemContext || 'اطلاعاتی ارائه نشده است.'}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return res.json({ text: response.text });
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
