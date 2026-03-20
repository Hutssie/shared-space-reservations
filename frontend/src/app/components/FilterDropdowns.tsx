import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Minus, 
  Wifi, 
  Zap, 
  Sun, 
  Coffee, 
  Car, 
  Shield, 
  Wind, 
  Star, 
  Heart, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Palette,
  Dumbbell,
  GraduationCap,
  Monitor,
  FlaskConical,
  Camera,
  Mic,
  Music,
  Tv,
  Utensils,
  ChefHat,
  ShowerHead,
  Trash2,
  Layers,
  Video,
  Speaker,
  Projector,
  Key,
  Ban,
  VolumeX,
  BookOpen,
  Microscope,
  Box
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import * as Slider from '@radix-ui/react-slider';
import * as Checkbox from '@radix-ui/react-checkbox';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isPast, addMonths, subMonths, getDay } from 'date-fns';

export const FilterWrapper = ({ children, trigger, open, onOpenChange }: any) => {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        {trigger}
      </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content 
        align="center" 
        sideOffset={8}
        collisionPadding={12}
        className="z-50 outline-none"
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="bg-white rounded-[1.25rem] sm:rounded-[2rem] shadow-2xl border border-brand-100 overflow-hidden w-[calc(100vw-48px)] sm:w-auto sm:min-w-[320px] max-w-md max-h-[65vh] sm:max-h-[70vh] flex flex-col text-xs sm:text-sm [&_svg]:size-3 sm:[&_svg]:size-4"
        >
          {children}
        </motion.div>
      </Popover.Content>
    </Popover.Portal>
    </Popover.Root>
  );
};

export const SpaceTypeDropdown = ({ trigger, selected = [], onApply }: any) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selected);
  const [isOpen, setIsOpen] = useState(false);

  // Sync local state when dropdown opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalSelected(selected);
    }
  }, [isOpen, selected]);

  const types = [
    { id: 'Art Studio', label: 'Art Studio', icon: Palette },
    { id: 'Sports Space', label: 'Sports Space', icon: Dumbbell },
    { id: 'Classroom', label: 'Classroom', icon: GraduationCap },
    { id: 'Conference Room', label: 'Conference Room', icon: Users },
    { id: 'IT Classroom', label: 'IT Classroom', icon: Monitor },
    { id: 'Laboratory', label: 'Laboratory', icon: FlaskConical },
    { id: 'Photo Studio', label: 'Photo Studio', icon: Camera },
    { id: 'Recording Studio', label: 'Recording Studio', icon: Mic },
    { id: 'Kitchen Studio', label: 'Kitchen Studio', icon: Coffee },
    { id: 'Dancing Studio', label: 'Dancing Studio', icon: Music },
  ];

  const toggleLocal = (id: string) => {
    setLocalSelected(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    onApply?.(localSelected);
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalSelected([]);
  };

  return (
    <FilterWrapper trigger={trigger} open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex flex-col h-full max-h-[inherit]">
        <div className="p-4 sm:p-6 w-full sm:w-[280px] overflow-y-auto flex-1">
          <h4 className="text-[10px] sm:text-xs font-black text-brand-400 uppercase tracking-widest mb-4">Select Space Type</h4>
          <div className="space-y-1">
            {types.map((type) => {
              const isSelected = localSelected.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => toggleLocal(type.id)}
                  className={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl transition-all group cursor-pointer
                    ${isSelected 
                      ? 'bg-brand-700 text-white shadow-md shadow-brand-700/10' 
                      : 'hover:bg-brand-50 text-brand-700'}
                  `}
                >
                  <type.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSelected ? 'text-brand-200' : 'text-brand-400 group-hover:text-brand-700'}`} />
                  <span className="font-bold text-xs sm:text-sm">{type.label}</span>
                  {isSelected && (
                    <div className="ml-auto w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-lg bg-brand-200 flex items-center justify-center">
                      <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand-700 rotate-45" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4 bg-brand-50 border-t border-brand-100 flex justify-between items-center shrink-0">
          <button 
            onClick={handleReset}
            className="text-xs font-bold text-brand-400 hover:text-brand-700 transition-colors cursor-pointer"
          >
            Reset
          </button>
          <button 
            onClick={handleApply}
            className="px-5 py-2.5 bg-brand-700 text-white font-black text-xs rounded-lg shadow-lg shadow-brand-700/20 active:scale-95 transition-all cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </FilterWrapper>
  );
};

const PRICE_DEFAULT: [number, number] = [0, 1000];

export const PriceDropdown = ({ trigger, value, onApply }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [range, setRange] = useState<[number, number]>(value ?? PRICE_DEFAULT);

  React.useEffect(() => {
    if (isOpen) setRange(value ?? PRICE_DEFAULT);
  }, [isOpen]);

  const handleApply = () => {
    onApply?.(range);
    setIsOpen(false);
  };

  const handleReset = () => setRange(PRICE_DEFAULT);

  return (
    <FilterWrapper trigger={trigger} open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex flex-col h-full max-h-[inherit]">
        <div className="p-6 sm:p-8 w-full sm:min-w-[320px] overflow-y-auto flex-1">
          <h4 className="text-xs sm:text-sm font-black text-brand-700 uppercase tracking-widest mb-6">Price Range (per hour)</h4>
          <div className="space-y-8">
            <Slider.Root 
              className="relative flex items-center select-none touch-none w-full h-5"
              value={range}
              onValueChange={(v) => setRange(v as [number, number])}
              max={1000}
              step={10}
            >
              <Slider.Track className="bg-brand-100 relative grow rounded-full h-1.5 sm:h-2">
                <Slider.Range className="absolute bg-brand-500 rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-5 h-5 sm:w-6 sm:h-6 bg-white border-2 border-brand-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer" />
              <Slider.Thumb className="block w-5 h-5 sm:w-6 sm:h-6 bg-white border-2 border-brand-500 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer" />
            </Slider.Root>
            
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex-1 p-2 sm:p-3 bg-brand-50 rounded-xl border border-brand-100">
                <span className="text-[9px] sm:text-[10px] font-black text-brand-400 block uppercase">Min</span>
                <span className="text-brand-700 font-bold text-sm sm:text-base">${range[0]}</span>
              </div>
              <div className="h-px w-3 sm:w-4 bg-brand-200" />
              <div className="flex-1 p-2 sm:p-3 bg-brand-50 rounded-xl border border-brand-100">
                <span className="text-[9px] sm:text-[10px] font-black text-brand-400 block uppercase">Max</span>
                <span className="text-brand-700 font-bold text-sm sm:text-base">${range[1]}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-brand-50 border-t border-brand-100 flex justify-between items-center shrink-0">
          <button
            onClick={handleReset}
            className="text-xs font-bold text-brand-400 hover:text-brand-700 transition-colors cursor-pointer"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2.5 bg-brand-700 text-white font-black text-xs rounded-lg shadow-lg shadow-brand-700/20 active:scale-95 transition-all cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </FilterWrapper>
  );
};

export const GuestsDropdown = ({ trigger, value, onApply }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState<number>(value ?? 1);
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isOpen) setCount(value ?? 1);
  }, [isOpen]);

  const stopHold = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; }
  };

  const startHold = (step: number) => {
    holdTimerRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        setCount((c) => Math.max(1, c + step));
      }, 80);
    }, 400);
  };

  const handleApply = () => {
    onApply?.(count);
    setIsOpen(false);
  };

  const handleReset = () => setCount(1);

  return (
    <FilterWrapper trigger={trigger} open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex flex-col h-full max-h-[inherit]">
        <div className="p-5 sm:p-6 space-y-6 w-full sm:w-[320px] overflow-y-auto flex-1">
          <div className="flex items-center justify-between gap-6 sm:gap-12">
            <div>
              <div className="font-bold text-sm sm:text-base text-brand-700">Number of People</div>
              <div className="text-[10px] sm:text-xs text-brand-400 font-medium">Total capacity needed</div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                onMouseDown={() => startHold(-1)}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={() => startHold(-1)}
                onTouchEnd={stopHold}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-brand-200 flex items-center justify-center hover:bg-brand-50 transition-colors select-none"
              >
                <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-500" />
              </button>
              <span className="w-8 text-center font-black text-sm sm:text-base text-brand-700">{count}</span>
              <button
                onClick={() => setCount((c) => c + 1)}
                onMouseDown={() => startHold(1)}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={() => startHold(1)}
                onTouchEnd={stopHold}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-brand-200 flex items-center justify-center hover:bg-brand-50 transition-colors select-none"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-500" />
              </button>
            </div>
          </div>
        </div>
        <div className="p-4 bg-brand-50 border-t border-brand-100 flex justify-between items-center shrink-0">
          <button
            onClick={handleReset}
            className="text-xs font-bold text-brand-400 hover:text-brand-700 transition-colors cursor-pointer"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2.5 bg-brand-700 text-white font-black text-xs rounded-lg shadow-lg shadow-brand-700/20 active:scale-95 transition-all cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </FilterWrapper>
  );
};

export const AmenitiesList = [
  { id: 'wifi', icon: Wifi, label: 'High-speed WiFi' },
  { id: 'light', icon: Sun, label: 'Natural Light' },
  { id: 'coffee', icon: Coffee, label: 'Free Coffee' },
  { id: 'parking', icon: Car, label: 'On-site Parking' },
  { id: 'ac', icon: Wind, label: 'Air Conditioning' },
  { id: 'access', icon: Shield, label: '24/7 Access' },
  { id: 'sound', icon: VolumeX, label: 'Soundproofed' },
  { id: 'cyc', icon: Layers, label: 'Cyclorama Wall' },
  { id: 'green', icon: Box, label: 'Green Screen' },
  { id: 'audio', icon: Speaker, label: 'Pro Sound System' },
  { id: 'mics', icon: Mic, label: 'Recording Gear' },
  { id: 'kitchen', icon: Utensils, label: 'Full Kitchen' },
  { id: 'chef', icon: ChefHat, label: 'Chef-grade Oven' },
  { id: 'projector', icon: Projector, label: 'Digital Projector' },
  { id: 'conferencing', icon: Video, label: 'Video Conferencing' },
  { id: 'monitors', icon: Monitor, label: 'Dual Monitors' },
  { id: 'easels', icon: Palette, label: 'Art Easels' },
  { id: 'mirrors', icon: Music, label: 'Full-length Mirrors' },
  { id: 'gym', icon: Dumbbell, label: 'Gym Equipment' },
  { id: 'showers', icon: ShowerHead, label: 'Locker Rooms' },
  { id: 'lab', icon: Microscope, label: 'Lab Equipment' },
];

export const FiltersContent = ({
  isSidebar = false,
  selectedAmenityIds = [],
  onAmenityChange,
}: {
  isSidebar?: boolean;
  selectedAmenityIds?: string[];
  onAmenityChange?: (ids: string[]) => void;
}) => {
  const isControlled = isSidebar && onAmenityChange != null;
  const content = (
    <section>
      <h4 className="text-[10px] sm:text-xs font-black text-brand-400 uppercase tracking-widest mb-4 sm:mb-6">Amenities</h4>
      <div className={`grid gap-3 sm:gap-4 ${!isSidebar ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {AmenitiesList.map((item) => {
          const checked = isControlled ? selectedAmenityIds.includes(item.id) : undefined;
          return (
            <label key={item.id} className="flex items-center justify-between group cursor-pointer pr-2 sm:pr-4 md:pr-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-brand-50 rounded-xl flex items-center justify-center group-hover:bg-brand-100 transition-colors shrink-0">
                  <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-brand-500" />
                </div>
                <span className="font-bold text-brand-700 text-xs sm:text-sm">{item.label}</span>
              </div>
              <Checkbox.Root
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-brand-100 flex items-center justify-center data-[state=checked]:bg-brand-700 transition-colors outline-none shrink-0 cursor-pointer"
                checked={checked}
                onCheckedChange={
                  isControlled
                    ? (isChecked) => {
                        const next = isChecked
                          ? [...selectedAmenityIds, item.id]
                          : selectedAmenityIds.filter((id) => id !== item.id);
                        onAmenityChange(next);
                      }
                    : undefined
                }
              >
                <Checkbox.Indicator>
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white rotate-45" />
                </Checkbox.Indicator>
              </Checkbox.Root>
            </label>
          );
        })}
      </div>
    </section>
  );

  if (isSidebar) {
    return <div className="space-y-8 sm:y-10">{content}</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full sm:w-[400px]">
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8 space-y-8 sm:space-y-10">
        {content}
      </div>
      <div className="p-4 bg-brand-50 border-t border-brand-100 flex items-center justify-between gap-4 shrink-0">
        <button className="text-brand-400 text-xs sm:text-sm font-bold hover:text-brand-700 underline underline-offset-4 decoration-2 cursor-pointer whitespace-nowrap">Clear all</button>
        <button className="flex-1 sm:flex-none px-6 sm:px-10 py-3 sm:py-4 bg-brand-700 text-white font-black text-[10px] sm:text-sm rounded-xl sm:rounded-2xl shadow-xl shadow-brand-700/20 active:scale-95 transition-all cursor-pointer truncate text-center uppercase tracking-wider">Show 150+ spaces</button>
      </div>
    </div>
  );
};

export const MoreFiltersDropdown = ({ trigger }: any) => {
  return (
    <FilterWrapper trigger={trigger}>
      <FiltersContent />
    </FilterWrapper>
  );
};

export const DateDropdown = ({ trigger, value, onChange }: any) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isOpen, setIsOpen] = useState(false);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const leadingDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    return getDay(start);
  }, [currentMonth]);

  const handleDateClick = (date: Date) => {
    if (isPast(date) && !isSameDay(date, new Date())) return;
    onChange?.(date);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <FilterWrapper 
      trigger={trigger} 
      open={isOpen} 
      onOpenChange={setIsOpen}
    >
      <div className="flex flex-col h-full max-h-[inherit]">
        <div className="p-4 sm:p-6 w-full sm:w-[360px] overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-6 sm:mb-8 px-2">
            <h4 className="font-black text-sm sm:text-base text-brand-700">{format(currentMonth, 'MMMM yyyy')}</h4>
            <div className="flex gap-2">
              <button 
                onClick={prevMonth}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-brand-50 hover:bg-brand-700 hover:text-white rounded-xl transition-all duration-300 hover:scale-110 active:scale-90 group/nav cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-400 group-hover/nav:text-white transition-colors" />
              </button>
              <button 
                onClick={nextMonth}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-brand-50 hover:bg-brand-700 hover:text-white rounded-xl transition-all duration-300 hover:scale-110 active:scale-90 group/nav cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-400 group-hover/nav:text-white transition-colors" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-6">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
              <div key={d} className="text-center text-[9px] sm:text-[10px] font-black text-brand-300 py-2 uppercase tracking-widest">{d}</div>
            ))}
            {Array.from({ length: leadingDays }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {daysInMonth.map((date) => {
              const isSelected = value && isSameDay(date, value);
              const isToday = isSameDay(date, new Date());
              const isDisabled = isPast(date) && !isToday;

              return (
                  <button 
                    key={date.toString()} 
                    disabled={isDisabled}
                    onClick={() => handleDateClick(date)}
                    className={`
                      aspect-square w-full flex items-center justify-center rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all relative group/date cursor-pointer
                      ${isDisabled 
                        ? 'text-brand-100 cursor-not-allowed' 
                        : isSelected
                          ? 'bg-brand-700 text-white shadow-xl shadow-brand-700/30 scale-105 z-10'
                          : 'text-brand-700 hover:bg-brand-50 hover:scale-110 active:scale-95'
                      }
                    `}
                  >
                    <span className="relative z-10">{format(date, 'd')}</span>
                    {!isDisabled && !isSelected && (
                      <div className="absolute inset-0 border border-brand-50 sm:border-2 rounded-lg sm:rounded-xl group-hover/date:border-brand-200 transition-colors" />
                    )}
                    {isToday && !isSelected && (
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-brand-200 rounded-full border border-white" />
                    )}
                  </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-brand-50 border-t border-brand-100 shrink-0">
          <button 
            onClick={() => setIsOpen(false)}
            className="w-full py-3 sm:py-4 bg-brand-700 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-xl shadow-brand-700/20 hover:bg-brand-600 transition-all active:scale-95 cursor-pointer"
          >
            Apply Search Date
          </button>
        </div>
      </div>
    </FilterWrapper>
  );
};
