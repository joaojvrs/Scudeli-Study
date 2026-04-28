import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { Tag, X, Plus, Hash } from 'lucide-react';

interface TagPickerProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

const TagPicker = ({ selectedTags, onChange }: TagPickerProps) => {
  const { tags, supabaseUser } = useAppContext();
  const [newTagName, setNewTagName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'
  ];

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !supabaseUser) return;
    
    const tagName = newTagName.trim().toLowerCase();
    
    // Check if exists
    if (tags.some(t => t.name === tagName)) {
      toggleTag(tagName);
      setNewTagName('');
      return;
    }

    try {
      const color = colors[Math.floor(Math.random() * colors.length)];
      await supabase.from('tags').insert({
        user_id: supabaseUser.id,
        name: tagName,
        color
      });
      toggleTag(tagName);
      setNewTagName('');
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'tags');
    }
  };

  const toggleTag = (name: string) => {
    if (selectedTags.includes(name)) {
      onChange(selectedTags.filter(t => t !== name));
    } else {
      onChange([...selectedTags, name]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selectedTags.map(tagName => {
          const tagInfo = tags.find(t => t.name === tagName);
          return (
            <span 
              key={tagName}
              className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 shadow-sm"
              style={{ 
                backgroundColor: tagInfo?.color ? `${tagInfo.color}15` : '#F3F4F6',
                color: tagInfo?.color || '#9CA3AF',
                border: `1px solid ${tagInfo?.color ? `${tagInfo.color}30` : '#E5E7EB'}`
              }}
            >
              <Hash size={10} />
              <span>{tagName}</span>
              <button 
                type="button"
                onClick={() => toggleTag(tagName)}
                className="hover:opacity-60 transition-opacity"
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>

      <div className="relative">
        <div className="flex items-center space-x-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus-within:ring-4 focus-within:ring-brand-primary/5 transition-all">
          <Tag size={16} className="text-gray-400" />
          <input 
            type="text"
            value={newTagName}
            onChange={(e) => {
              setNewTagName(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateTag();
              }
            }}
            placeholder="Adicionar tags..."
            className="flex-1 bg-transparent outline-none text-sm font-bold"
          />
          <button 
            type="button"
            onClick={handleCreateTag}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400"
          >
            <Plus size={18} />
          </button>
        </div>

        {showSuggestions && newTagName && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl z-30 max-h-48 overflow-y-auto p-2 scrollbar-hide">
            {tags
              .filter(t => t.name.includes(newTagName.toLowerCase()) && !selectedTags.includes(t.name))
              .map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    toggleTag(t.name);
                    setNewTagName('');
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-sm font-bold text-gray-700">{t.name}</span>
                  </div>
                  <Plus size={14} className="text-gray-300 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            {tags.filter(t => t.name.includes(newTagName.toLowerCase())).length === 0 && (
              <button
                type="button"
                onClick={handleCreateTag}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-brand-light text-brand-primary flex items-center space-x-3 transition-all"
              >
                <Plus size={14} />
                <span className="text-sm font-bold">Criar tag "{newTagName}"</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagPicker;
