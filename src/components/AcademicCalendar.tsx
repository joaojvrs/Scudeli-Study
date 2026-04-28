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
  Trash2
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { EventType, Event } from '../types';

const AcademicCalendar = () => {
  const { events, subjects, supabaseUser, refreshAllData } = useAppContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>(EventType.OTHER);
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [eventDate, setEventDate] = useState('');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const openAddForm = () => {
    setEditingEvent(null);
    setTitle('');
    setType(EventType.OTHER);
    setSubjectId('');
    setStartTime('08:00');
    setEndTime('09:00');
    setEventDate(format(selectedDate, 'yyyy-MM-dd'));
    setIsAdding(true);
  };

  const openEditForm = (event: Event) => {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    setEditingEvent(event);
    setTitle(event.title);
    setType(event.type);
    setSubjectId(event.subject_id || '');
    setStartTime(format(startDate, 'HH:mm'));
    setEndTime(format(endDate, 'HH:mm'));
    setEventDate(format(startDate, 'yyyy-MM-dd'));
    setIsAdding(true);
    setConfirmDeleteId(null);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingEvent(null);
  };

  const buildDates = () => {
    const base = eventDate ? new Date(eventDate + 'T00:00:00') : selectedDate;
    const [startH, startM] = startTime.split(':');
    const [endH, endM] = endTime.split(':');
    const start = new Date(base);
    start.setHours(parseInt(startH), parseInt(startM));
    const end = new Date(base);
    end.setHours(parseInt(endH), parseInt(endM));
    return { start, end };
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !title) return;
    const { start, end } = buildDates();
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
      closeForm();
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'events');
    }
  };

  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !title) return;
    const { start, end } = buildDates();
    try {
      await supabase.from('events').update({
        title,
        type,
        start: start.toISOString(),
        end: end.toISOString(),
        subject_id: subjectId || 'none',
      }).eq('id', editingEvent.id);
      closeForm();
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, 'events');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await supabase.from('events').delete().eq('id', id);
      setConfirmDeleteId(null);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.DELETE, 'events');
    }
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(e => isSameDay(new Date(e.start), day));
  };

  const getEventColor = (type: EventType) => {
    switch (type) {
      case EventType.EXAM: return 'bg-red-500';
      case EventType.CLASS: return 'bg-blue-500';
      case EventType.REVIEW: return 'bg-brand-primary';
      default: return 'bg-gray-400';
    }
  };

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
               <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs">Eventos do Dia</h3>
               <button
                 onClick={openAddForm}
                 className="p-2 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-105 transition-transform"
               >
                  <Plus size={18} />
               </button>
            </div>

            <AnimatePresence mode="wait">
               {isAdding ? (
                 <motion.form
                   key="form"
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   onSubmit={editingEvent ? handleEditEvent : handleAddEvent}
                   className="space-y-4"
                 >
                    <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">
                      {editingEvent ? 'Editar Evento' : 'Novo Evento'}
                    </p>
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
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-gray-400 uppercase">Data</label>
                       <input
                         type="date"
                         value={eventDate}
                         onChange={(e) => setEventDate(e.target.value)}
                         className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none"
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
                          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Fim</label>
                          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-3 bg-brand-bg rounded-xl text-sm outline-none" />
                       </div>
                    </div>
                    <div className="flex pt-4 space-x-3">
                       <button type="button" onClick={closeForm} className="flex-1 text-gray-400 font-bold text-sm">Cancelar</button>
                       <button type="submit" className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-primary/20">
                         {editingEvent ? 'Atualizar' : 'Salvar'}
                       </button>
                    </div>
                 </motion.form>
               ) : (
                 <motion.div
                   key="list"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="space-y-4"
                 >
                    {getEventsForDay(selectedDate).length > 0 ? getEventsForDay(selectedDate).map(event => (
                      <div key={event.id} className="p-4 rounded-2xl bg-brand-bg border border-gray-100 group">
                        <div className="flex items-start space-x-3">
                          <div className={`w-1 self-stretch min-h-[40px] rounded-full flex-shrink-0 ${getEventColor(event.type)}`} />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 group-hover:text-brand-primary transition-colors">{event.title}</h4>
                            <div className="flex items-center space-x-3 mt-2">
                               <div className="flex items-center space-x-1 text-[10px] text-gray-400 font-bold">
                                  <Clock size={12} />
                                  <span>{format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}</span>
                               </div>
                               <div className="flex items-center space-x-1 text-[10px] text-gray-400 font-bold uppercase truncate max-w-[80px]">
                                  <Tag size={12} />
                                  <span>{subjects.find(s => s.id === event.subject_id)?.name || 'Geral'}</span>
                               </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditForm(event)}
                              className="p-1.5 hover:bg-brand-primary/10 rounded-lg text-gray-400 hover:text-brand-primary transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(event.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {confirmDeleteId === event.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between overflow-hidden"
                            >
                              <span className="text-[11px] text-red-500 font-bold">Excluir este evento?</span>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-[11px] text-gray-400 font-bold px-2 py-1"
                                >
                                  Não
                                </button>
                                <button
                                  onClick={() => handleDeleteEvent(event.id)}
                                  className="text-[11px] text-white font-bold px-3 py-1 bg-red-500 rounded-lg"
                                >
                                  Sim
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
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
