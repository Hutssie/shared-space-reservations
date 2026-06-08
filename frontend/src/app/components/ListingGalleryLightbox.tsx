import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './ImageWithFallback';

const DRAG_THRESHOLD = 5;

type GalleryThumbnailStripProps = {
  images: string[];
  activeIndex: number;
  open: boolean;
  onSelect: (index: number) => void;
};

function GalleryThumbnailStrip({ images, activeIndex, open, onSelect }: GalleryThumbnailStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const dragState = useRef({
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    didDrag: false,
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const updateEdgeState = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(overflow && el.scrollLeft > 0);
    setCanScrollRight(overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useLayoutEffect(() => {
    updateEdgeState();
  }, [images.length, updateEdgeState]);

  useLayoutEffect(() => {
    if (!open) return;
    const thumb = thumbRefs.current[activeIndex];
    if (!thumb) return;
    thumb.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
    requestAnimationFrame(updateEdgeState);
  }, [activeIndex, open, prefersReducedMotion, updateEdgeState]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateEdgeState);
    ro.observe(el);
    el.addEventListener('scroll', updateEdgeState, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateEdgeState);
    };
  }, [updateEdgeState]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const el = stripRef.current;
    if (!el) return;

    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      didDrag: false,
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== dragState.current.pointerId) return;
      const deltaX = ev.clientX - dragState.current.startX;
      if (!dragState.current.didDrag && Math.abs(deltaX) > DRAG_THRESHOLD) {
        dragState.current.didDrag = true;
        setIsDragging(true);
      }
      if (dragState.current.didDrag) {
        ev.preventDefault();
        el.scrollLeft = dragState.current.scrollLeft - deltaX;
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== dragState.current.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setIsDragging(false);
      dragState.current.pointerId = -1;
      if (dragState.current.didDrag) {
        window.setTimeout(() => {
          dragState.current.didDrag = false;
        }, 0);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleThumbClick = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (dragState.current.didDrag) {
      e.preventDefault();
      return;
    }
    onSelect(idx);
  };

  return (
    <div className="relative max-w-7xl mx-auto">
      {canScrollLeft && (
        <div
          className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-10"
          aria-hidden
        />
      )}
      {canScrollRight && (
        <div
          className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-10"
          aria-hidden
        />
      )}
      <div
        ref={stripRef}
        className={`overflow-x-auto scrollbar-hide ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        style={{ touchAction: 'pan-x' }}
        onPointerDown={handlePointerDown}
      >
        <div className="flex w-max min-w-full gap-3 px-2 py-2">
          {images.map((img, idx) => (
            <div
              key={idx}
              ref={(el) => {
                thumbRefs.current[idx] = el;
              }}
              className={`shrink-0 rounded-xl transition-all ${
                idx === activeIndex
                  ? 'ring-4 ring-white scale-105'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <button
                type="button"
                onClick={(e) => handleThumbClick(e, idx)}
                className="block w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden cursor-pointer"
              >
                <ImageWithFallback
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type ListingGalleryLightboxProps = {
  open: boolean;
  images: string[];
  activeIndex: number;
  onClose: () => void;
  onActiveIndexChange: (index: number) => void;
};

export function ListingGalleryLightbox({
  open,
  images,
  activeIndex,
  onClose,
  onActiveIndexChange,
}: ListingGalleryLightboxProps) {
  const currentIndex = Math.min(activeIndex, Math.max(images.length - 1, 0));

  const prev = useCallback(() => {
    onActiveIndexChange(currentIndex <= 0 ? images.length - 1 : currentIndex - 1);
  }, [currentIndex, images.length, onActiveIndexChange]);

  const next = useCallback(() => {
    onActiveIndexChange(currentIndex >= images.length - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, images.length, onActiveIndexChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (images.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, images.length, onClose, prev, next]);

  if (images.length === 0) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden"
          onClick={onClose}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-6 right-6 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Close gallery"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full text-white font-bold">
            {currentIndex + 1} / {images.length}
          </div>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          <div
            className="relative w-full h-full flex items-center justify-center p-6 md:p-12 pb-32 md:pb-36"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-7xl max-h-full"
            >
              <ImageWithFallback
                src={images[currentIndex]}
                alt={`Space ${currentIndex + 1}`}
                className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-2xl shadow-2xl"
              />
            </motion.div>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <GalleryThumbnailStrip
              images={images}
              activeIndex={currentIndex}
              open={open}
              onSelect={onActiveIndexChange}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
