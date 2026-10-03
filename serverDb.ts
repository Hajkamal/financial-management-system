import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'server_db.json');

// Default initial state
const DEFAULT_SUPER_ADMIN = {
  id: 'user-vahid',
  email: 'vahidkamali03@gmail.com',
  firstName: 'وحید',
  lastName: 'کمالی',
  fullName: 'وحید کمالی',
  // Default password: admin (SHA-256)
  password: 'sha256:8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  role: 'super_admin',
  roleTitle: 'مدیر کل سامانه',
  status: 'active',
  permissions: {
    canViewDashboard: true,
    canViewTransactions: true,
    canCreateTransactions: true,
    canEditTransactions: true,
    canDeleteTransactions: true,
    canViewSalary: true,
    canEditSalary: true,
    canManageEmployees: true,
    canManageMembers: true,
    canManageLoans: true,
    canManageFiscalYears: true,
    canManageUsers: true,
    canExportExcel: true,
    canBackupRestore: true,
  },
  avatarColor: 'from-amber-500 to-yellow-600',
  createdAt: '۱۴۰۵/۰۱/۰۱',
  lastLogin: 'امروز',
  phone: '۰۹۱۲۳۴۵۶۷۸۹',
  notes: 'مدیر ارشد و مالک سامانه',
};

const DEFAULT_FISCAL_YEAR = {
  year: 1405,
  title: 'سال مالی ۱۴۰۵ (جاری)',
  startDate: '۱۴۰۵/۰۱/۰۱',
  endDate: '۱۴۰۵/۱۲/۲۹',
  isClosed: false,
  notes: 'سال مالی جدید',
  openingBalance: 0,
};

export interface ServerDatabase {
  version: number;
  lastUpdated: string;
  selectedYear: number;
  users: any[];
  fiscalYears: any[];
  transactions: any[];
  employees: any[];
  salaryMatrix: any[];
  members: any[];
  loans: any[];
  bankAccounts: any[];
  vatInvoices: any[];
  serviceTariffs: any[];
  customCategories?: any[];
  companyLogo?: string | null;
}

function getDefaultDb(): ServerDatabase {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    selectedYear: 1405,
    users: [DEFAULT_SUPER_ADMIN],
    fiscalYears: [DEFAULT_FISCAL_YEAR],
    transactions: [],
    employees: [],
    salaryMatrix: [],
    members: [],
    loans: [],
    bankAccounts: [],
    vatInvoices: [],
    serviceTariffs: [],
    customCategories: [],
    companyLogo: null,
  };
}

let inMemoryDb: ServerDatabase | null = null;

export function loadDatabase(): ServerDatabase {
  if (inMemoryDb) return inMemoryDb;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      // Validate schema has all arrays
      inMemoryDb = {
        version: parsed.version || 1,
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        selectedYear: parsed.selectedYear || 1405,
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [DEFAULT_SUPER_ADMIN],
        fiscalYears: Array.isArray(parsed.fiscalYears) && parsed.fiscalYears.length > 0 ? parsed.fiscalYears : [DEFAULT_FISCAL_YEAR],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        employees: Array.isArray(parsed.employees) ? parsed.employees : [],
        salaryMatrix: Array.isArray(parsed.salaryMatrix) ? parsed.salaryMatrix : [],
        members: Array.isArray(parsed.members) ? parsed.members : [],
        loans: Array.isArray(parsed.loans) ? parsed.loans : [],
        bankAccounts: Array.isArray(parsed.bankAccounts) ? parsed.bankAccounts : [],
        vatInvoices: Array.isArray(parsed.vatInvoices) ? parsed.vatInvoices : [],
        serviceTariffs: Array.isArray(parsed.serviceTariffs) ? parsed.serviceTariffs : [],
      };
      return inMemoryDb;
    }
  } catch (err) {
    console.error('Error loading database, using default:', err);
  }

  inMemoryDb = getDefaultDb();
  saveDatabase(inMemoryDb);
  return inMemoryDb;
}

export function saveDatabase(db: ServerDatabase): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db.lastUpdated = new Date().toISOString();
    inMemoryDb = db;
    
    // Write atomically via tmp file
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Error saving database:', err);
    return false;
  }
}

export function resetDatabaseToClean(): ServerDatabase {
  const currentDb = loadDatabase();
  // Retain existing users (so admin password remains intact) or keep super_admin
  const existingUsers = currentDb.users && currentDb.users.length > 0 ? currentDb.users : [DEFAULT_SUPER_ADMIN];
  
  const freshDb: ServerDatabase = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    selectedYear: 1405,
    users: existingUsers,
    fiscalYears: [DEFAULT_FISCAL_YEAR],
    transactions: [],
    employees: [],
    salaryMatrix: [],
    members: [],
    loans: [],
    bankAccounts: [],
    vatInvoices: [],
    serviceTariffs: [],
  };

  saveDatabase(freshDb);
  return freshDb;
}

// اطمینان از ایجاد فایل پایگاه داده در دایرکتوری سرور به هنگام استارت
try {
  loadDatabase();
} catch (e) {
  console.warn('Initial serverDb load warning:', e);
}
