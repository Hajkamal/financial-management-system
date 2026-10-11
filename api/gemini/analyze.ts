import { GoogleGenAI } from '@google/genai';

// Vercel Serverless Function handler for /api/gemini/analyze
export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, systemContext, history } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!apiKey) {
      return res.status(503).json({
        error: 'کلید دسترسی هوش مصنوعی (GEMINI_API_KEY) در متغیرهای محیطی سرور تنظیم نشده است.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `شما «دستیار هوشمند مالی و تحلیل‌گر ارشد شرکت آینده نگاران خلاق» هستید.
دستورالعمل‌های حیاتی:
۱. تحلیل دقیق، محاسباتی و منحصراً بر اساس پرسش مشخص کاربر. به هیچ عنوان پاسخ کلی، تکراری، کلیشه‌ای، فرمالیته یا قالب از پیش آماده ارائه ندهید. به هر پرسش مستقیماً و با استخراج ارقام دقیق از داده‌های مالی پاسخ دهید.
۲. اگر کاربر درباره فرد خاصی، ماه خاصی، سرفصل خاصی، یا محاسبه مشخصی سوال کرد، منحصراً روی همان موضوع تمرکز کنید و ارقام مربوط به آن را محاسبه و بیان کنید.
۳. کلیه ارقام مالی، مبالغ، درصدهای سود/زیان، نام افراد و کلیدواژه‌های اصلی را حتماً در قالب بولد مارک‌داون (**متن**) بنویسید تا در نمایشگر برجسته دیده شوند.
۴. مبالغ را هم به صورت ریال و هم معادل تومان با تفکیک سه‌رقمی فارسی درج کنید.
۵. اگر اطلاعات مرتبط با سوال در پرونده موجود نیست، صادقانه اعلام کنید که سندی با این مشخصات ثبت نشده است و گمانه‌زنی نکنید.
۶. لحن پاسخ‌ها باید محترمانه، ساختاریافته، شفاف و مبتنی بر حسابداری رسمی و واقعیت داده‌های شرکت باشد.

داده‌های مالی زنده و واقعی شرکت آینده نگاران خلاق:
${systemContext || 'اطلاعاتی ارائه نشده است.'}
`;

    const candidateModels = [
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ];

    let contents: any = prompt;
    if (Array.isArray(history) && history.length > 0) {
      const rawTurns = history
        .filter((msg: any) => msg && msg.text && msg.sender)
        .slice(-6)
        .map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: String(msg.text).trim() }],
        }))
        .filter((turn: any) => turn.parts[0].text.length > 0);

      while (rawTurns.length > 0 && rawTurns[0].role !== 'user') {
        rawTurns.shift();
      }

      const sanitizedTurns: any[] = [];
      for (const turn of rawTurns) {
        if (sanitizedTurns.length === 0 || sanitizedTurns[sanitizedTurns.length - 1].role !== turn.role) {
          sanitizedTurns.push(turn);
        } else {
          sanitizedTurns[sanitizedTurns.length - 1].parts[0].text += '\n' + turn.parts[0].text;
        }
      }

      if (sanitizedTurns.length > 0) {
        if (sanitizedTurns[sanitizedTurns.length - 1].role === 'user') {
          sanitizedTurns[sanitizedTurns.length - 1].parts[0].text += '\n' + prompt;
          contents = sanitizedTurns;
        } else {
          contents = [...sanitizedTurns, { role: 'user', parts: [{ text: prompt }] }];
        }
      } else {
        contents = prompt;
      }
    }

    let generatedText: string | null = null;
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.4,
          },
        });

        if (response && response.text) {
          generatedText = response.text;
          break;
        }
      } catch {
        continue;
      }
    }

    if (generatedText) {
      return res.status(200).json({ text: generatedText });
    }

    return res.status(503).json({
      error: 'دستیار در حال حاضر با تقاضای بالا مواجه است، لطفاً مجدداً تلاش فرمایید.',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'خطا در ارتباط با هوش مصنوعی',
    });
  }
}
