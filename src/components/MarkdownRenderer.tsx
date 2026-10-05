import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

/**
 * رندر کننده پیشرفته مارک‌داون فارسی
 * - تبدیل کلمات بولد (**کلمه** یا __کلمه__) به برچسب‌های متنی برجسته و خوانا
 * - حذف کامل ستاره‌های مزاحم و نمادهای خام
 * - پشتیبانی از تیترها (H1 تا H4)، لیست‌های بولت و عددی فارسی، جداول (|...|) و نقل‌قول‌ها
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  isUser = false,
}) => {
  if (!content) return null;

  // تابع پارس عبارات درون‌خطی (Bold, Italic, Code) با اولویت‌بندی دقیق
  const renderInlineText = (text: string): React.ReactNode[] => {
    if (!text) return [];

    // الگوی دقیق تشخیص المان‌های درون خطی بدون تداخل
    // ۱. کد: `...`
    // ۲. بولد ایتالیک: ***...***
    // ۳. بولد: **...** یا __...__
    // ۴. ایتالیک: *...* یا _..._
    const tokenRegex = /(`[^`]+`|\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|__[^_]+?__|\*[^*\s](?:[^*]*?[^*\s])?\*|_[^_\s](?:[^_]*?[^_\s])?_)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // کد درون‌خطی
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        const innerText = part.slice(1, -1);
        return (
          <code 
            key={index} 
            className={`font-mono text-[11px] px-1.5 py-0.5 rounded dir-ltr inline-block ${
              isUser ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-800'
            }`}
          >
            {innerText}
          </code>
        );
      }

      // بولد + ایتالیک (***متن***)
      if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
        const innerText = part.slice(3, -3).trim();
        return (
          <strong 
            key={index} 
            className={`font-black italic ${
              isUser 
                ? 'text-white underline underline-offset-2' 
                : 'text-indigo-950 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300/60 font-extrabold mx-0.5 inline-block'
            }`}
          >
            {innerText}
          </strong>
        );
      }

      // بولد با ** یا __
      if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
          (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
        const innerText = part.slice(2, -2).trim();
        return (
          <strong 
            key={index} 
            className={`font-black ${
              isUser 
                ? 'text-white bg-blue-700/80 px-1 py-0.5 rounded underline underline-offset-2 mx-0.5' 
                : 'text-slate-900 bg-amber-50/90 text-indigo-950 px-1.5 py-0.5 rounded border border-amber-200/70 shadow-2xs font-extrabold mx-0.5 inline-block'
            }`}
          >
            {innerText}
          </strong>
        );
      }

      // ایتالیک با * یا _
      if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
          (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
        const innerText = part.slice(1, -1).trim();
        return (
          <em key={index} className={`italic font-semibold ${isUser ? 'text-blue-100' : 'text-indigo-900'}`}>
            {innerText}
          </em>
        );
      }

      // متن عادی: پاکسازی هرگونه ستاره یا آندرلاین سرگردان احتمالی
      const sanitizedText = part
        .replace(/\*\*/g, '')
        .replace(/(?<!\w)\*(?!\w)/g, '');

      return <React.Fragment key={index}>{sanitizedText}</React.Fragment>;
    });
  };

  // تجزیه خط به خط برای تیترها، جداول، لیست‌ها و پاراگراف‌ها
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      renderedElements.push(
        <ul key={`list-${renderedElements.length}`} className="my-2 space-y-1.5 pr-1">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (inTable && (tableHeader.length > 0 || tableRows.length > 0)) {
      renderedElements.push(
        <div key={`table-${renderedElements.length}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-right text-xs">
            {tableHeader.length > 0 && (
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  {tableHeader.map((h, i) => (
                    <th key={i} className="p-2.5">
                      {renderInlineText(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-slate-700">
                      {renderInlineText(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeader = [];
      tableRows = [];
      inTable = false;
    }
  };

  const flushAll = () => {
    flushList();
    flushTable();
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // خط خالی
    if (!trimmed) {
      flushAll();
      renderedElements.push(<div key={`empty-${lineIdx}`} className="h-1.5" />);
      return;
    }

    // خط جداکننده (--- یا ***)
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushAll();
      renderedElements.push(
        <hr key={`hr-${lineIdx}`} className="my-3 border-t border-slate-200" />
      );
      return;
    }

    // سطر جدول مارک‌داون (| ... | ... |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      // آیا سطر جداکننده سرستون است؟ (| --- | --- |)
      const isDivider = cells.every(c => /^[-:\s]+$/.test(c));

      if (isDivider) {
        inTable = true;
        return;
      }

      if (!inTable && tableHeader.length === 0) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    }

    // اگر از جدول خارج شدیم
    if (inTable) {
      flushTable();
    }

    // تیتر سطح ۴ (####)
    if (trimmed.startsWith('#### ')) {
      flushList();
      const headingText = trimmed.replace(/^####\s+/, '');
      renderedElements.push(
        <h4
          key={`h4-${lineIdx}`}
          className={`font-black text-xs mt-2.5 mb-1 flex items-center gap-1.5 ${
            isUser ? 'text-white' : 'text-slate-800'
          }`}
        >
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block" />
          <span>{renderInlineText(headingText)}</span>
        </h4>
      );
      return;
    }

    // تیتر سطح ۳ (###)
    if (trimmed.startsWith('### ')) {
      flushList();
      const headingText = trimmed.replace(/^###\s+/, '');
      renderedElements.push(
        <h3
          key={`h3-${lineIdx}`}
          className={`font-black text-xs sm:text-sm mt-3.5 mb-1.5 pb-1 border-b flex items-center gap-1.5 ${
            isUser ? 'text-white border-blue-400' : 'text-slate-900 border-indigo-100 text-indigo-950'
          }`}
        >
          <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full inline-block" />
          <span>{renderInlineText(headingText)}</span>
        </h3>
      );
      return;
    }

    // تیتر سطح ۲ (##)
    if (trimmed.startsWith('## ')) {
      flushList();
      const headingText = trimmed.replace(/^##\s+/, '');
      renderedElements.push(
        <h2
          key={`h2-${lineIdx}`}
          className={`font-black text-sm sm:text-base mt-4 mb-2 pb-1.5 border-b flex items-center gap-2 ${
            isUser ? 'text-white border-blue-400' : 'text-indigo-950 border-indigo-200'
          }`}
        >
          <span className="w-2 h-4 bg-indigo-700 rounded-full inline-block" />
          <span>{renderInlineText(headingText)}</span>
        </h2>
      );
      return;
    }

    // تیتر سطح ۱ (#)
    if (trimmed.startsWith('# ')) {
      flushList();
      const headingText = trimmed.replace(/^#\s+/, '');
      renderedElements.push(
        <h1
          key={`h1-${lineIdx}`}
          className={`font-black text-base sm:text-lg mt-4 mb-2 ${
            isUser ? 'text-white' : 'text-indigo-950'
          }`}
        >
          {renderInlineText(headingText)}
        </h1>
      );
      return;
    }

    // لیست‌های نشانه‌دار (- یا * یا • یا +)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ') || trimmed.startsWith('+ ')) {
      inList = true;
      const itemText = trimmed.replace(/^[-*•+]\s+/, '');
      listItems.push(
        <li key={`li-${lineIdx}`} className="flex items-start gap-2 text-xs leading-relaxed">
          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isUser ? 'bg-white' : 'bg-indigo-600'}`} />
          <span className="flex-1">{renderInlineText(itemText)}</span>
        </li>
      );
      return;
    }

    // لیست‌های شماره‌دار (1. 2. 3. یا ۱. ۲. ۳.)
    const numberedMatch = trimmed.match(/^(\d+|[\u06F0-\u06F9]+)[.)]\s+(.*)$/);
    if (numberedMatch) {
      flushList();
      const numStr = numberedMatch[1];
      const rest = numberedMatch[2];
      renderedElements.push(
        <div key={`num-${lineIdx}`} className="flex items-start gap-2 my-1.5 text-xs leading-relaxed">
          <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${
            isUser ? 'bg-blue-700 text-white' : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
          }`}>
            {numStr}
          </span>
          <span className="flex-1">{renderInlineText(rest)}</span>
        </div>
      );
      return;
    }

    // نقل قول (>)
    if (trimmed.startsWith('> ')) {
      flushList();
      const quoteText = trimmed.replace(/^>\s+/, '');
      renderedElements.push(
        <blockquote
          key={`quote-${lineIdx}`}
          className={`border-r-4 pr-3 py-1.5 my-2 text-xs rounded-l ${
            isUser ? 'border-blue-300 bg-blue-700/50 text-blue-100' : 'border-indigo-500 bg-indigo-50/60 text-slate-700'
          }`}
        >
          {renderInlineText(quoteText)}
        </blockquote>
      );
      return;
    }

    // پاراگراف عادی
    flushList();
    renderedElements.push(
      <p key={`p-${lineIdx}`} className="my-1.5 text-xs leading-relaxed">
        {renderInlineText(line)}
      </p>
    );
  });

  flushAll();

  return <div className={`font-sans ${className}`}>{renderedElements}</div>;
};
