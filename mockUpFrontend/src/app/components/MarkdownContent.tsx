import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownContentProps = {
  children: string;
  className?: string;
  onImageClick?: (src: string) => void;
};

const proseClasses = [
  'text-brand-700 font-medium leading-relaxed',
  '[&_strong]:font-black [&_strong]:text-brand-800',
  '[&_em]:italic',
  '[&_a]:text-brand-500 [&_a]:underline [&_a]:hover:text-brand-700',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1',
  '[&_p]:mb-2 [&_p:last-child]:mb-0',
  '[&_h1]:text-2xl [&_h1]:font-black [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-black [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-1',
].join(' ');

export const MarkdownContent = ({ children, className = '', onImageClick }: MarkdownContentProps) => {
  if (!children || typeof children !== 'string') {
    return <span className={className}>{children}</span>;
  }
  const components = onImageClick
    ? {
        img: ({ src, alt }: { src?: string; alt?: string }) =>
          src ? (
            <img
              src={src}
              alt={alt ?? ''}
              className="cursor-pointer rounded-2xl max-w-full h-auto border border-brand-100 shadow-sm"
              onClick={(e) => {
                e.preventDefault();
                onImageClick(src);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onImageClick(src)}
            />
          ) : null,
      }
    : undefined;

  return (
    <div className={`${proseClasses} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
};
