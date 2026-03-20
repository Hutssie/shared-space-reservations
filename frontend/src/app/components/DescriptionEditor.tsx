import React, { useRef, useCallback } from 'react';
import { Bold, Italic, List, Link as LinkIcon } from 'lucide-react';

type DescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  'data-testid'?: string;
};

function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string
): { newValue: string; newStart: number; newEnd: number } {
  const selected = text.slice(start, end);
  const newValue = text.slice(0, start) + before + selected + after + text.slice(end);
  const newStart = start + before.length;
  const newEnd = newStart + selected.length;
  return { newValue, newStart, newEnd };
}

export const DescriptionEditor = ({
  value,
  onChange,
  placeholder = "Describe your space... Use **bold** and *italic* for emphasis.",
  className = '',
  minHeight = '160px',
  'data-testid': dataTestId,
}: DescriptionEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = useCallback(
    (before: string, after: string, fallbackEmpty?: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);
      let newValue: string;
      let newStart: number;
      let newEnd: number;
      if (start !== end) {
        const result = wrapSelection(value, start, end, before, after);
        newValue = result.newValue;
        newStart = result.newStart;
        newEnd = result.newEnd;
      } else {
        const insert = fallbackEmpty ?? `${before}${after}`;
        newValue = value.slice(0, start) + insert + value.slice(end);
        newStart = start + before.length;
        newEnd = newStart + (fallbackEmpty ? 0 : after.length);
      }
      onChange(newValue);
      el.focus();
      requestAnimationFrame(() => {
        el.setSelectionRange(newStart, newEnd);
      });
    },
    [value, onChange]
  );

  const handleBold = () => applyFormat('**', '**', '****');
  const handleItalic = () => applyFormat('*', '*', '**');
  const handleBullet = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const insert = value.slice(lineStart, start).trimStart().length === 0 ? '- ' : '\n- ';
    const newValue = value.slice(0, start) + insert + value.slice(start);
    onChange(newValue);
    el.focus();
    el.setSelectionRange(start + insert.length, end + insert.length);
  };
  const handleLink = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const before = selected ? '[' : '[';
    const after = selected ? '](url)' : '](url)';
    const result = wrapSelection(value, start, end, before, after);
    onChange(result.newValue);
    el.focus();
    const linkEnd = result.newStart + (selected || 'text').length + 2; // ](
    requestAnimationFrame(() => el.setSelectionRange(linkEnd, linkEnd + 3));
  };

  return (
    <div className={`rounded-[1.25rem] md:rounded-[1.5rem] border-2 border-brand-100/50 focus-within:border-brand-700 focus-within:bg-white bg-brand-50 transition-all overflow-hidden ${className}`}>
      <div className="flex items-center gap-1 px-3 py-2 border-b border-brand-100/50 bg-brand-50/80">
        <button
          type="button"
          onClick={handleBold}
          className="p-2 rounded-lg text-brand-500 hover:bg-brand-200/50 hover:text-brand-700 transition-colors"
          title="Bold"
          aria-label="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleItalic}
          className="p-2 rounded-lg text-brand-500 hover:bg-brand-200/50 hover:text-brand-700 transition-colors"
          title="Italic"
          aria-label="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleBullet}
          className="p-2 rounded-lg text-brand-500 hover:bg-brand-200/50 hover:text-brand-700 transition-colors"
          title="Bullet list"
          aria-label="Bullet list"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleLink}
          className="p-2 rounded-lg text-brand-500 hover:bg-brand-200/50 hover:text-brand-700 transition-colors"
          title="Link"
          aria-label="Insert link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-medium text-brand-400 uppercase tracking-wider ml-2">
          Markdown supported
        </span>
      </div>
      <textarea
        ref={textareaRef}
        data-testid={dataTestId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-5 md:px-8 py-4 md:py-5 bg-transparent outline-none font-bold text-brand-700 text-base md:text-lg leading-relaxed placeholder:text-brand-200 resize-none min-h-[120px]"
        style={{ minHeight }}
      />
    </div>
  );
};
