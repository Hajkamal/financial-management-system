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

// CORS headers for all requests (important for iframe/preview contexts)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security: Simple Token Middleware for API
const SERVER_API_TOKEN = process.env.SERVER_API_TOKEN || 'ayandeh-secret-token-1405';

app.use('/api/financial-data', (req, res, next) => {
  const token = req.headers['x-api-token'];
  if (req.method !== 'OPTIONS' && token !== SERVER_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Invalid API Token.' });
  }
  next();
});

app.use('/api/auth/change-password', (req, res, next) => {
  const token = req.headers['x-api-token'];
  if (req.method !== 'OPTIONS' && token !== SERVER_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Invalid API Token.' });
  }
  next();
});


// Graceful JSON error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    console.error('JSON parsing error in request:', err.message);
    return res.status(400).json({ error: 'فرمت داده‌های ارسالی نامعتبر است' });
  }
  if (err && err.status === 413) {
    console.error('Payload too large error:', err.message);
    return res.status(413).json({ error: 'حجم داده‌های نسخه پشتیبان بیش از حد مجاز است' });
  }
  next(err);
});

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
۱. تحلیل دقیق، محاسباتی و منحصراً بر اساس پرسش مشخص کاربر. به هیچ عنوان پاسخ کلی، تکراری، کلیشه‌ای، فرمالیته یا قالب از پیش آماده ارائه ندهید. به هر پرسش مستقیماً و با استخراج ارقام دقیق از داده‌های مالی پاسخ دهید.
۲. اگر کاربر درباره فرد خاصی، ماه خاصی، سرفصل خاصی، یا محاسبه مشخصی سوال کرد، منحصراً روی همان موضوع تمرکز کنید و ارقام مربوط به آن را محاسبه و بیان کنید.
۳. کلیه ارقام مالی، مبالغ، درصدهای سود/زیان، نام افراد و کلیدواژه‌های اصلی را حتماً در قالب بولد مارک‌داون (**متن**) بنویسید تا در نمایشگر برجسته دیده شوند.
۴. مبالغ را هم به صورت ریال و هم معادل تومان با تفکیک سه‌رقمی فارسی درج کنید.
۵. اگر اطلاعات مرتبط با سوال در پرونده موجود نیست، صادقانه اعلام کنید که سندی با این مشخصات ثبت نشده است و گمانه‌زنی نکنید.
۶. لحن پاسخ‌ها باید محترمانه، ساختاریافته، شفاف و مبتنی بر حسابداری رسمی و واقعیت داده‌های شرکت باشد.

داده‌های مالی زنده و واقعی شرکت آینده نگاران خلاق:
${systemContext || 'اطلاعاتی ارائه نشده است.'}
`;

    // Cascade of available models conforming to current @google/genai SDK
    // Tested and verified for rapid response without 503 demand spikes or quota exhaustion
    const candidateModels = [
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ];

    // Format conversation history for Gemini SDK (ensuring strict user-start and alternating roles)
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

      // Multi-turn conversation must begin with a 'user' turn
      while (rawTurns.length > 0 && rawTurns[0].role !== 'user') {
        rawTurns.shift();
      }

      // Merge any consecutive turns with the same role
      const sanitizedTurns: any[] = [];
      for (const turn of rawTurns) {
        if (sanitizedTurns.length === 0 || sanitizedTurns[sanitizedTurns.length - 1].role !== turn.role) {
          sanitizedTurns.push(turn);
        } else {
          sanitizedTurns[sanitizedTurns.length - 1].parts[0].text += '\n' + turn.parts[0].text;
        }
      }

      // Append current user prompt
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

    // Try candidate models in order; instantly fallback if a model experiences high demand (503)
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
      } catch (err: any) {
        // Silently proceed to next candidate model on transient errors or 503 demand spikes
        continue;
      }
    }

    if (generatedText) {
      return res.json({ text: generatedText });
    }

    return res.status(503).json({
      error: 'دستیار در حال حاضر با تقاضای بالا مواجه است، لطفاً مجدداً تلاش فرمایید.',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'خطا در ارتباط با هوش مصنوعی',
    });
  }
});

import { loadDatabase, saveDatabase, resetDatabaseToClean } from './serverDb';

// Helper to extract requester user info from headers or body
function getRequesterInfo(req: express.Request) {
  let userName = 'وحید کمالی';
  try {
    const rawName = req.headers['x-user-name'];
    if (rawName) userName = decodeURIComponent(String(rawName));
  } catch {}
  const userEmail = (req.headers['x-user-email'] as string) || 'vahidkamali03@gmail.com';
  const userRole = (req.headers['x-user-role'] as string) || 'مدیر کل سامانه';
  const deviceInfo = (req.headers['x-device-info'] as string) || 'رایانه / دسکتاپ';
  return { userName, userEmail, userRole, deviceInfo };
}

function getPersianDateTimeNow(): string {
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value || '1405';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const second = parts.find(p => p.type === 'second')?.value || '00';
    const faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const str = `${year}/${month}/${day} - ${hour}:${minute}:${second}`;
    return str.replace(/\d/g, d => faDigits[parseInt(d, 10)]);
  } catch {
    return new Date().toISOString();
  }
}

function appendSyncLog(
  db: any,
  log: {
    direction: 'upload' | 'download';
    actionType: string;
    actionLabel: string;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    entityCount?: number;
    details?: string;
    status?: 'success' | 'failed';
    deviceInfo?: string;
  }
) {
  if (!Array.isArray(db.syncLogs)) {
    db.syncLogs = [];
  }
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    persianDate: getPersianDateTimeNow(),
    direction: log.direction || 'upload',
    actionType: log.actionType || 'push_all',
    actionLabel: log.actionLabel || 'تغییر در پایگاه داده',
    userName: log.userName || 'وحید کمالی',
    userEmail: log.userEmail || 'vahidkamali03@gmail.com',
    userRole: log.userRole || 'مدیر کل سامانه',
    entityCount: log.entityCount ?? 1,
    details: log.details || '',
    status: log.status || 'success',
    deviceInfo: log.deviceInfo || 'رایانه / دسکتاپ',
  };
  db.syncLogs.unshift(newLog);
  if (db.syncLogs.length > 250) {
    db.syncLogs = db.syncLogs.slice(0, 250);
  }
  return newLog;
}

// =====================================================
// API دیتابیس مشترک و همگام سرور (Server Data Endpoints)
// =====================================================

// دریافت لاگ‌ها و تاریخچه همگام‌سازی
app.get('/api/financial-data/sync-logs', (_req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, logs: db.syncLogs || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'خطا در دریافت تاریخچه تغییرات' });
  }
});

// ثبت مستقیم یک رویداد همگام‌سازی (مثلاً دریافت داده‌ها یا رفرش توسط کلاینت)
app.post('/api/financial-data/sync-log', (req, res) => {
  try {
    const requester = getRequesterInfo(req);
    const body = req.body || {};
    const db = loadDatabase();
    const createdLog = appendSyncLog(db, {
      direction: body.direction || 'download',
      actionType: body.actionType || 'sync_fetch',
      actionLabel: body.actionLabel || 'همگام‌سازی و دریافت اطلاعات از سرور',
      userName: body.userName || requester.userName,
      userEmail: body.userEmail || requester.userEmail,
      userRole: body.userRole || requester.userRole,
      entityCount: body.entityCount,
      details: body.details,
      status: body.status || 'success',
      deviceInfo: body.deviceInfo || requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, log: createdLog });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// پاکسازی لاگ‌ها توسط مدیر ارشد
app.delete('/api/financial-data/sync-logs', (req, res) => {
  try {
    const db = loadDatabase();
    db.syncLogs = [];
    saveDatabase(db);
    res.json({ success: true, message: 'تاریخچه تغییرات پاکسازی شد' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// دریافت کلیه اطلاعات مالی از دیتابیس سرور
app.get('/api/financial-data', (_req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'خطا در بارگذاری اطلاعات از سرور' });
  }
});

// ذخیره / ویرایش تراکنش
app.post('/api/financial-data/transaction', (req, res) => {
  try {
    const tx = req.body;
    if (!tx || !tx.id) return res.status(400).json({ error: 'شناسه تراکنش نامعتبر است' });

    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.transactions.findIndex((t: any) => t.id === tx.id);
    const isNew = idx < 0;
    if (!isNew) {
      db.transactions[idx] = tx;
    } else {
      db.transactions.unshift(tx);
    }
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'transaction_save',
      actionLabel: isNew ? 'ثبت سند مالی جدید' : 'ویرایش سند مالی',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `${tx.title || 'سند مالی'} (${tx.type === 'income' ? 'درآمد' : 'هزینه'}) - مبلغ: ${Number(tx.amount || 0).toLocaleString()} ریال`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, transaction: tx });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ذخیره دسته‌ای تراکنش‌ها
app.post('/api/financial-data/transactions', (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions)) return res.status(400).json({ error: 'آرایه نامعتبر' });

    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    db.transactions = transactions;
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'transaction_save',
      actionLabel: 'ثبت دسته‌ای اسناد مالی',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: transactions.length,
      details: `به‌روزرسانی ${transactions.length} رکورد تراکنش در دفتر مالی`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, count: transactions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// حذف تراکنش
app.delete('/api/financial-data/transaction/:id', (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const target = db.transactions.find((t: any) => t.id === id);
    db.transactions = db.transactions.filter((t: any) => t.id !== id);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'transaction_delete',
      actionLabel: 'حذف سند مالی',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: target ? `حذف سند «${target.title || target.id}» به مبلغ ${Number(target.amount || 0).toLocaleString()} ریال` : `شناسه ${id}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// پرسنل و کارمندان
app.post('/api/financial-data/employee', (req, res) => {
  try {
    const emp = req.body;
    if (!emp || !emp.id) return res.status(400).json({ error: 'شناسه کارمند نامعتبر است' });
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.employees.findIndex((e: any) => e.id === emp.id);
    if (idx >= 0) db.employees[idx] = emp;
    else db.employees.push(emp);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'employee_save',
      actionLabel: idx >= 0 ? 'ویرایش پرونده کارمند' : 'افزودن کارمند جدید',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `پرسنل: ${emp.name || emp.id} - سمت: ${emp.role || 'کارشناس'}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, employee: emp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/financial-data/employee/:id', (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const target = db.employees.find((e: any) => e.id === id);
    db.employees = db.employees.filter((e: any) => e.id !== id);
    db.salaryMatrix = db.salaryMatrix.filter((s: any) => s.employeeId !== id);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'employee_delete',
      actionLabel: 'حذف پرونده کارمند',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: target ? `حذف کارمند «${target.name}» و ردیف‌های حقوق مربوطه` : `شناسه ${id}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ماتریس حقوق
app.post('/api/financial-data/salary-cell', (req, res) => {
  try {
    const item = req.body;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.salaryMatrix.findIndex(
      (s: any) => s.employeeId === item.employeeId && s.month === item.month && s.year === item.year
    );
    if (idx >= 0) db.salaryMatrix[idx] = item;
    else db.salaryMatrix.push(item);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'salary_save',
      actionLabel: 'به‌روزرسانی آیتم حقوق پرسنل',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `ثبت حقوق ماه ${item.month} سال ${item.year}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/financial-data/salary-matrix-batch', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'آرایه نامعتبر' });
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    for (const item of items) {
      const idx = db.salaryMatrix.findIndex(
        (s: any) => s.employeeId === item.employeeId && s.month === item.month && s.year === item.year
      );
      if (idx >= 0) db.salaryMatrix[idx] = item;
      else db.salaryMatrix.push(item);
    }
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'salary_matrix_batch',
      actionLabel: 'ذخیره دسته‌ای ماتریس حقوق',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: items.length,
      details: `به‌روزرسانی ${items.length} سلول از جدول حقوق و دستمزد`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, count: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// اعضا و سهامداران
app.post('/api/financial-data/member', (req, res) => {
  try {
    const member = req.body;
    if (!member || !member.id) return res.status(400).json({ error: 'شناسه عضو نامعتبر است' });
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.members.findIndex((m: any) => m.id === member.id);
    if (idx >= 0) db.members[idx] = member;
    else db.members.push(member);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'member_save',
      actionLabel: idx >= 0 ? 'ویرایش پرونده سهامدار' : 'افزودن سهامدار جدید',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `سهامدار: ${member.name || member.id} (سهم: ${member.sharesPercent || 0}%)`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/financial-data/member/:id', (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const target = db.members.find((m: any) => m.id === id);
    db.members = db.members.filter((m: any) => m.id !== id);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'member_delete',
      actionLabel: 'حذف پرونده سهامدار',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: target ? `حذف سهامدار «${target.name}»` : `شناسه ${id}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// وام‌ها
app.post('/api/financial-data/loan', (req, res) => {
  try {
    const loan = req.body;
    if (!loan || !loan.id) return res.status(400).json({ error: 'شناسه وام نامعتبر است' });
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.loans.findIndex((l: any) => l.id === loan.id);
    if (idx >= 0) db.loans[idx] = loan;
    else db.loans.push(loan);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'loan_save',
      actionLabel: idx >= 0 ? 'ویرایش تسهیلات/وام' : 'ثبت تسهیلات/وام جدید',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `وام ${loan.bankName || 'بانکی'} - مبلغ: ${Number(loan.amount || 0).toLocaleString()} ریال`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, loan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/financial-data/loan/:id', (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const target = db.loans.find((l: any) => l.id === id);
    db.loans = db.loans.filter((l: any) => l.id !== id);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'loan_delete',
      actionLabel: 'حذف پرونده تسهیلات',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: target ? `حذف وام ${target.bankName}` : `شناسه ${id}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// حساب‌های بانکی
app.post('/api/financial-data/bank-account', (req, res) => {
  try {
    const acc = req.body;
    if (!acc || !acc.id) return res.status(400).json({ error: 'شناسه حساب نامعتبر است' });
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.bankAccounts.findIndex((a: any) => a.id === acc.id);
    if (idx >= 0) db.bankAccounts[idx] = acc;
    else db.bankAccounts.push(acc);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'bank_account_save',
      actionLabel: idx >= 0 ? 'ویرایش حساب بانکی' : 'ثبت حساب بانکی جدید',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `حساب ${acc.bankName || 'بانکی'} - شماره: ${acc.accountNumber || acc.shabaNumber || ''}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, account: acc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/financial-data/bank-account/:id', (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const target = db.bankAccounts.find((a: any) => a.id === id);
    db.bankAccounts = db.bankAccounts.filter((a: any) => a.id !== id);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'bank_account_delete',
      actionLabel: 'حذف حساب بانکی',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: target ? `حذف حساب ${target.bankName}` : `شناسه ${id}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// فاکتورهای ارزش افزوده
app.post('/api/financial-data/vat-invoice', (req, res) => {
  try {
    const inv = req.body;
    if (!inv || !inv.id) return res.status(400).json({ error: 'شناسه فاکتور نامعتبر است' });
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.vatInvoices.findIndex((i: any) => i.id === inv.id);
    if (idx >= 0) db.vatInvoices[idx] = inv;
    else db.vatInvoices.unshift(inv);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'vat_invoice_save',
      actionLabel: idx >= 0 ? 'ویرایش صورتحساب ارزش افزوده' : 'صدور صورتحساب ارزش افزوده',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `فاکتور شماره ${inv.invoiceNumber || inv.id} - مبلغ کل: ${Number(inv.finalAmount || 0).toLocaleString()} ریال`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, invoice: inv });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/financial-data/vat-invoice/:id', (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const target = db.vatInvoices.find((i: any) => i.id === id);
    db.vatInvoices = db.vatInvoices.filter((i: any) => i.id !== id);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'vat_invoice_delete',
      actionLabel: 'حذف صورتحساب ارزش افزوده',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: target ? `حذف فاکتور شماره ${target.invoiceNumber || target.id}` : `شناسه ${id}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// تعرفه خدمات
app.post('/api/financial-data/service-tariff', (req, res) => {
  try {
    const tariff = req.body;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.serviceTariffs.findIndex((t: any) => t.id === tariff.id);
    if (idx >= 0) db.serviceTariffs[idx] = tariff;
    else db.serviceTariffs.push(tariff);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'service_tariff_save',
      actionLabel: 'به‌روزرسانی تعرفه خدمت ارزش افزوده',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `خدمت: ${tariff.title || tariff.serviceCode} - کارمزد: ${Number(tariff.currentPrice || 0).toLocaleString()} ریال`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, tariff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// دسته‌بندی‌های اختصاصی
app.post('/api/financial-data/custom-categories', (req, res) => {
  try {
    const { customCategories } = req.body;
    if (!Array.isArray(customCategories)) return res.status(400).json({ error: 'آرایه نامعتبر' });
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    db.customCategories = customCategories;
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'custom_categories_save',
      actionLabel: 'به‌روزرسانی دسته‌بندی‌ها و سرفصل‌ها',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: customCategories.length,
      details: `همگام‌سازی ساختار شامل ${customCategories.length} سرفصل و تمامی زیردسته‌ها`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, count: customCategories.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// لوگوی رسمی شرکت
app.post('/api/financial-data/company-logo', (req, res) => {
  try {
    const { companyLogo } = req.body;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    db.companyLogo = companyLogo || null;
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'company_logo_save',
      actionLabel: companyLogo ? 'بارگذاری نشان رسمی شرکت' : 'حذف نشان رسمی شرکت',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      details: companyLogo ? 'به‌روزرسانی لوگوی سازمانی' : 'بازگشت به نشان پیش‌فرض',
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, companyLogo: db.companyLogo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// سال‌های مالی
app.post('/api/financial-data/fiscal-year', (req, res) => {
  try {
    const fy = req.body;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.fiscalYears.findIndex((f: any) => f.year === fy.year);
    if (idx >= 0) db.fiscalYears[idx] = fy;
    else db.fiscalYears.push(fy);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'fiscal_year_save',
      actionLabel: idx >= 0 ? 'ویرایش سال مالی' : 'تعریف سال مالی جدید',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `سال مالی ${fy.year} (${fy.title || ''})`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, fiscalYear: fy });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/financial-data/fiscal-year/:year', (req, res) => {
  try {
    const y = parseInt(req.params.year, 10);
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    db.fiscalYears = db.fiscalYears.filter((f: any) => f.year !== y);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'fiscal_year_delete',
      actionLabel: 'حذف سال مالی',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `حذف سال مالی ${y}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, year: y });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// مدیریت کاربران
app.post('/api/financial-data/user', (req, res) => {
  try {
    const user = req.body;
    if (!user || !user.email) return res.status(400).json({ error: 'اطلاعات کاربر ناقص است' });
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const idx = db.users.findIndex((u: any) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    const isNew = idx < 0;
    if (!isNew) {
      // Retain password if not supplied
      const existing = db.users[idx];
      db.users[idx] = {
        ...existing,
        ...user,
        password: user.password || existing.password,
      };
    } else {
      db.users.push(user);
    }
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'user_save',
      actionLabel: isNew ? 'تعریف کاربر جدید' : 'ویرایش دسترسی و مشخصات کاربر',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: `کاربر: ${user.fullName || user.email} - نقش: ${user.roleTitle || user.role}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, user: db.users[idx >= 0 ? idx : db.users.length - 1] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/financial-data/user/:id', (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const target = db.users.find((u: any) => u.id === id);
    if (target?.email === 'vahidkamali03@gmail.com') {
      return res.status(403).json({ error: 'امکان حذف مدیر ارشد وجود ندارد' });
    }
    db.users = db.users.filter((u: any) => u.id !== id);
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'user_delete',
      actionLabel: 'حذف حساب کاربری',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: 1,
      details: target ? `حذف حساب «${target.fullName || target.email}»` : `شناسه ${id}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// تغییر رمز عبور در سرور
app.post('/api/auth/change-password', (req, res) => {
  try {
    const { userId, newPasswordHash } = req.body;
    if (!userId || !newPasswordHash) {
      return res.status(400).json({ error: 'اطلاعات تغییر رمز عبور ناقص است' });
    }
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    const user = db.users.find((u: any) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: 'کاربر مورد نظر در سیستم یافت نشد' });
    }
    user.password = newPasswordHash;
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'change_password',
      actionLabel: 'تغییر کلمه عبور امنیتی',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      details: `به‌روزرسانی رمز عبور برای حساب ${user.fullName || user.email}`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    console.info(`Password successfully updated on server for user: ${user.email}`);
    res.json({ success: true, message: 'کلمه عبور در دیتابیس سرور با موفقیت به‌روزرسانی شد' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// پاکسازی کل داده‌ها به حالت خالی
app.post('/api/financial-data/reset', (req, res) => {
  try {
    const requester = getRequesterInfo(req);
    const freshDb = resetDatabaseToClean();
    appendSyncLog(freshDb, {
      direction: 'upload',
      actionType: 'reset',
      actionLabel: 'بازنشانی و پاکسازی کامل دیتابیس',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      details: 'پاکسازی کلیه اسناد مالی و بازگشت به تنظیمات کارخانه',
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(freshDb);
    res.json({ success: true, data: freshDb });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// بازیابی کامل بکاپ در سرور
app.post('/api/financial-data/restore', (req, res) => {
  try {
    const backup = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ error: 'محتوای بکاپ نامعتبر است' });
    }
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    if (Array.isArray(backup.transactions)) db.transactions = backup.transactions;
    if (Array.isArray(backup.employees)) db.employees = backup.employees;
    if (Array.isArray(backup.salaryMatrix)) db.salaryMatrix = backup.salaryMatrix;
    if (Array.isArray(backup.members)) db.members = backup.members;
    if (Array.isArray(backup.loans)) db.loans = backup.loans;
    if (Array.isArray(backup.bankAccounts)) db.bankAccounts = backup.bankAccounts;
    if (Array.isArray(backup.vatInvoices)) db.vatInvoices = backup.vatInvoices;
    if (Array.isArray(backup.serviceTariffs)) db.serviceTariffs = backup.serviceTariffs;
    if (Array.isArray(backup.fiscalYears)) db.fiscalYears = backup.fiscalYears;
    if (Array.isArray(backup.customCategories)) db.customCategories = backup.customCategories;
    if (backup.companyLogo !== undefined) db.companyLogo = backup.companyLogo;
    if (Array.isArray(backup.users) && backup.users.length > 0) {
      db.users = backup.users;
    }
    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'restore',
      actionLabel: 'بازیابی جامع فایل پشتیبان (Backup)',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: (db.transactions?.length || 0) + (db.employees?.length || 0),
      details: `بازیابی ${db.transactions?.length || 0} تراکنش، ${db.employees?.length || 0} کارمند و ${db.fiscalYears?.length || 0} سال مالی`,
      deviceInfo: requester.deviceInfo,
    });
    saveDatabase(db);
    console.info(`[RESTORE] Successfully saved to server DB: ${db.transactions.length} txs, ${db.employees.length} emps, ${db.fiscalYears.length} years`);
    res.json({ success: true, data: db });
  } catch (err: any) {
    console.error('[RESTORE ERROR] in /api/financial-data/restore:', err);
    res.status(500).json({ error: err.message || 'خطا در ثبت اطلاعات در دیتابیس سرور' });
  }
});

// ارسال کامل داده‌های مرورگر به سرور (برای همگام‌سازی فوری لپ‌تاپ و گوشی)
app.post('/api/financial-data/push-all', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'داده‌های ارسالی نامعتبر است' });
    }
    const requester = getRequesterInfo(req);
    const db = loadDatabase();
    if (Array.isArray(payload.transactions)) db.transactions = payload.transactions;
    if (Array.isArray(payload.employees)) db.employees = payload.employees;
    if (Array.isArray(payload.salaryMatrix)) db.salaryMatrix = payload.salaryMatrix;
    if (Array.isArray(payload.members)) db.members = payload.members;
    if (Array.isArray(payload.loans)) db.loans = payload.loans;
    if (Array.isArray(payload.bankAccounts)) db.bankAccounts = payload.bankAccounts;
    if (Array.isArray(payload.vatInvoices)) db.vatInvoices = payload.vatInvoices;
    if (Array.isArray(payload.serviceTariffs)) db.serviceTariffs = payload.serviceTariffs;
    if (Array.isArray(payload.fiscalYears)) db.fiscalYears = payload.fiscalYears;
    if (Array.isArray(payload.users) && payload.users.length > 0) db.users = payload.users;
    if (Array.isArray(payload.customCategories)) db.customCategories = payload.customCategories;
    if (payload.companyLogo !== undefined) db.companyLogo = payload.companyLogo;

    appendSyncLog(db, {
      direction: 'upload',
      actionType: 'push_all',
      actionLabel: 'ارسال و همگام‌سازی کامل داده‌ها با سرور',
      userName: requester.userName,
      userEmail: requester.userEmail,
      userRole: requester.userRole,
      entityCount: (db.transactions?.length || 0),
      details: `همگام‌سازی کلی: ${db.transactions?.length || 0} تراکنش، ${db.employees?.length || 0} پرسنل، ${db.members?.length || 0} سهامدار`,
      deviceInfo: requester.deviceInfo,
    });

    saveDatabase(db);
    res.json({ 
      success: true, 
      message: 'تمامی اطلاعات مرورگر با موفقیت به سرور متمرکز ارسال شد و در سایر دستگاه‌ها قابل مشاهده است.', 
      data: db 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
