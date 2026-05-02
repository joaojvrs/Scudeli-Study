import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
  isSameMonth, isSameDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
}

const DatePicker = ({ value, onChange, className = '' }: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() =>
    value ? new Date(value + 'T00:00:00') : new Date()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  const monthStart = startOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(monthStart))
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleDayClick = (day: Date) => {
    onChange(format(day, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const displayValue = selectedDate
    ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : 'Selecionar data';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full p-3 bg-white border border-brand-accent rounded-xl text-sm flex items-center justify-between focus:border-brand-primary transition-colors outline-none group"
      >
        <span className={selectedDate ? 'text-gray-800 font-medium' : 'text-gray-400'}>
          {displayValue}
        </span>
        <CalendarIcon size={14} className="text-brand-primary shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 w-[300px]">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-brand-light rounded-lg text-gray-400 hover:text-brand-primary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-gray-800 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-brand-light rounded-lg text-gray-400 hover:text-brand-primary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-gray-300 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, i) => {
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, monthStart);

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`
                    h-9 w-full flex items-center justify-center rounded-xl text-xs font-medium transition-all
                    ${isSelected
                      ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/30'
                      : isToday
                        ? 'border-2 border-brand-primary text-brand-primary font-bold'
                        : isCurrentMonth
                          ? 'text-gray-700 hover:bg-brand-light hover:text-brand-primary'
                          : 'text-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
            {selectedDate ? (
              <button
                type="button"
                onClick={() => { onChange(''); setIsOpen(false); }}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
              >
                Limpar
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={() => {
                const today = format(new Date(), 'yyyy-MM-dd');
                onChange(today);
                setIsOpen(false);
              }}
              className="text-xs text-brand-primary font-bold hover:underline transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
