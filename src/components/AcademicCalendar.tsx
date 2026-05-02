import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Tag,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Event as CalEvent, EventType } from '../types';

const AcademicCalendar = () => {
  const { events, subjects, supabaseUser, refreshAllData } = useAppContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);

  // New Event Form
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>(EventType.OTHER);
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');

  // Edit Event Form
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<EventType>(EventType.OTHER);
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editStartTime, setEditStartTime] = useState('08:00');
  const [editEndTime, setEditEndTime] = useState('09:00');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const handleStartEdit = (event: CalEvent) => {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditType(event.type);
    setEditSubjectId(event.subject_id || '');
    setEditStartTime(format(new Date(event.start), 'HH:mm'));
    setEditEndTime(format(new Date(event.end), 'HH:mm'));
    setIsAdding(false);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !title) return;

    const [startH, startM] = startTime.split(':');
    const [endH, endM] = endTime.split(':');

    const start = new Date(selectedDate);
    start.setHours(parseInt(startH), parseInt(startM));

    const end = new Date(selectedDate);
    end.setHours(parseInt(endH), parseInt(endM));

    try {
      await supabase.from('events').insert({
        title,
        type,
        start: start.toISOString(),
        end: end.toISOString(),
        subject_id: subjectId || 'none',
        user_id: supabaseUser.id,
        created_at: new Date().toISOString()
      });
      setTitle('');
      setIsAdding(false);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'events');
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editTitle) return;

    const [startH, startM] = editStartTime.split(':');
    const [endH, endM] = editEndTime.split(':');

    const start = new Date(editingEvent.start);
    start.setHours(parseInt(startH), parseInt(startM), 0, 0);

    const end = new Date(editingEvent.start);
    end.setHours(parseInt(endH), parseInt(endM), 0, 0);

    try {
      await supabase.from('events').update({
        title: editTitle,
        type: editType,
        subject_id: editSubjectId || 'none',
        start: start.toISOString(),
        end: end.toISOString(),
      }).eq('id', editingEvent.id);
      setEditingEvent(null);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, `events/${editingEvent.id}`);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await supabase.from('events').delete().eq('id', id);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.DELETE, `events/${id}`);
    }
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(e => isSameDay(new Date(e.start), day));
  };

  const getEventColor = (t: EventType) => {
    switch (t) {
      case EventType.EXAM: return 'bg-red-500';
      case EventType.CLASS: return 'bg-blue-500';
      case EventType.REVIEW: return 'bg-brand-primary';
      default: return 'bg-gray-400';
    }
  };

  const sidebarMode = editingEvent ? 'editing' : isAdding ? 'adding' : 'list';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-full pb-10">
      <div className="xl:col-span-2 space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
              <CalendarIcon size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Calendário Acadêmico</h2>
          </div>
          <div className="flex items-center bg-white p-2 rounded-2xl shadow-sm border border-gray-50">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-brand-bg rounded-xl text-gray-400">
              <ChevronLeft size={20} />
            </button>
            <span className="px-4 font-bold text-sm min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-brand-bg rounded-xl text-gray-400">
              <ChevronRight size={20} />
            </button>
          </div>
        </header>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-50">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="p-4 text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, monthStart);

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[120px] p-2 border-b border-r border-gray-50 cursor-pointer transition-colors relative ${
                    !isCurrentMonth ? 'bg-gray-50/30' : 'hover:bg-brand-light/20'
                  } ${isSelected ? 'bg-brand-light/30' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-brand-primary text-white' : isCurrentMonth ? 'text-gray-900' : 'text-gray-300'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-none">
                    {dayEvents.map(e => (
                      <div
                        key={e.id}
                        className={`px-2 py-1 rounded text-[9px] font-bold text-white truncate shadow-sm ${getEventColor(e.type)}`}
                      >
                        {e.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-50 sticky top-24">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs">
              {sidebarMode === 'editing' ? 'Editar Evento' : sidebarMode === 'adding' ? 'Novo Evento' : 'Eventos do Dia'}
            </h3>
            {sidebarMode === 'list' && (
              <button
                onClick={() => setIsAdding(true)}
                className="p-2 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-105 transition-transform"
              >
                <Plus size={18} />
              </button>
            )}
            {sidebarMode !== 'list' && (
              <button
                onClick={() => { setIsAdding(false); setEditingEvent(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {sidebarMode === 'adding' && (
              <motion.form
                key="add-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleAddEvent}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Título</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none"
                    placeholder="Ex: Prova de Farmacologia"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as EventType)}
                      className="w-full p-3 bg-brand-bg rounded-xl text-xs outline-none"
                    >
                      <option value={EventType.EXAM}>Prova</option>
                      <option value={EventType.CLASS}>Aula</option>
                      <option value={EventType.REVIEW}>Revisão</option>
                      <option value={EventType.OTHER}>Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Disciplina</label>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="w-full p-3 bg-brand-bg rounded-xl text-xs outline-none"
                    >
                      <option value="">Nenhuma</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Início</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Fim</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none"
                    />
                  </div>
                </div>
                <div className="flex pt-4 space-x-3">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 text-gray-400 font-bold text-sm">Cancelar</button>
                  <button type="submit" className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-primary/20">Salvar</button>
                </div>
              </motion.form>
            )}

            {sidebarMode === 'editing' && (
              <motion.form
                key="edit-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleUpdateEvent}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Título</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as EventType)}
                      className="w-full p-3 bg-brand-bg rounded-xl text-xs outline-none"
                    >
                      <option value={EventType.EXAM}>Prova</option>
                      <option value={EventType.CLASS}>Aula</option>
                      <option value={EventType.REVIEW}>Revisão</option>
                      <option value={EventType.OTHER}>Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Disciplina</label>
                    <select
                      value={editSubjectId}
                      onChange={(e) => setEditSubjectId(e.target.value)}
                      className="w-full p-3 bg-brand-bg rounded-xl text-xs outline-none"
                    >
                      <option value="">Nenhuma</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Início</label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Fim</label>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none"
                    />
                  </div>
                </div>
                <div className="flex pt-4 space-x-3">
                  <button type="button" onClick={() => setEditingEvent(null)} className="flex-1 text-gray-400 font-bold text-sm">Cancelar</button>
                  <button type="submit" className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-primary/20">Atualizar</button>
                </div>
              </motion.form>
            )}

            {sidebarMode === 'list' && (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {getEventsForDay(selectedDate).length > 0 ? getEventsForDay(selectedDate).map(event => (
                  <div key={event.id} className="flex items-start space-x-4 p-4 rounded-2xl bg-brand-bg border border-gray-100 group">
                    <div className={`w-1 h-full min-h-[40px] rounded-full ${getEventColor(event.type)}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-brand-primary transition-colors">{event.title}</h4>
                      <div className="flex items-center space-x-3 mt-2">
                        <div className="flex items-center space-x-1 text-[10px] text-gray-400 font-bold">
                          <Clock size={12} />
                          <span>{format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-[10px] text-gray-400 font-bold uppercase truncate max-w-[100px]">
                          <Tag size={12} />
                          <span>{subjects.find(s => s.id === event.subject_id)?.name || 'Geral'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleStartEdit(event)}
                        className="p-1.5 text-gray-300 hover:text-brand-primary rounded-lg hover:bg-white transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20">
                    <p className="text-gray-400 text-sm italic">Nenhum evento para este dia.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AcademicCalendar;
