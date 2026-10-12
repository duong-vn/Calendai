'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Cpu,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  type AIModelOption,
  getModelById,
} from '@/lib/ai/models';

interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  className?: string;
}

type FilterTab = 'all' | 'free' | 'tools';

export function ModelSelector({
  selectedModel,
  onSelectModel,
  className = '',
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<AIModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentModel = useMemo(() => {
    const found = models.find((m) => m.id === selectedModel);
    return found || getModelById(selectedModel);
  }, [models, selectedModel]);

  // Fetch live AI models on mount and resolve default model
  useEffect(() => {
    let isMounted = true;

    async function fetchModels() {
      if (hasFetched) return;
      setIsLoadingModels(true);
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        if (isMounted) {
          if (Array.isArray(data?.models) && data.models.length > 0) {
            setModels(data.models);
          }
          if (data?.defaultModel && !selectedModel) {
            onSelectModel(data.defaultModel);
          }
          setHasFetched(true);
        }
      } catch {
        // Fallback to empty/default models
      } finally {
        if (isMounted) setIsLoadingModels(false);
      }
    }

    fetchModels();

    return () => {
      isMounted = false;
    };
  }, [hasFetched, selectedModel, onSelectModel]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return models.filter((model) => {
      // Tab filter
      if (activeTab === 'free' && !model.isFree) return false;
      if (activeTab === 'tools' && !model.supportsTools) return false;

      // Search query
      if (!q) return true;
      return (
        model.name.toLowerCase().includes(q) ||
        model.id.toLowerCase().includes(q) ||
        model.provider.toLowerCase().includes(q)
      );
    });
  }, [models, activeTab, searchQuery]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectModel(customInput.trim());
      setCustomInput('');
      setShowCustomInput(false);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Chọn mô hình AI (Đang chọn: ${currentModel.name})`}
        className="group flex min-h-[34px] touch-manipulation items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-2.5 py-1 text-xs font-medium text-[#1f1f1f] shadow-2xs transition-all hover:border-[#1a73e8] hover:bg-[#f8fafd] active:scale-95 sm:px-3 sm:py-1.5 dark:border-[#23382d] dark:bg-[#16221d] dark:text-[#f1f5f9] dark:hover:border-[#10b981] dark:hover:bg-[#1c2e26]"
      >
        <div className="flex h-4 w-4 items-center justify-center rounded-full text-[#1a73e8] dark:text-[#10b981]">
          {currentModel.isFree ? (
            <Zap className="h-3.5 w-3.5 text-[#34a853] dark:text-[#34d399]" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-[#fbbc04] dark:text-[#fbbf24]" />
          )}
        </div>

        <span className="max-w-[125px] truncate sm:max-w-[170px]">
          {currentModel.name || 'Mô hình AI'}
        </span>

        {currentModel.badge && (
          <span
            className={`rounded-full px-1.5 py-0.2 text-[11px] font-semibold ${
              currentModel.isFree
                ? 'bg-[#e6f4ea] text-[#137333] dark:bg-[#064e3b] dark:text-[#a7f3d0]'
                : 'bg-[#fef7e0] text-[#b06000] dark:bg-[#332408] dark:text-[#fde047]'
            }`}
          >
            {currentModel.badge}
          </span>
        )}

        <ChevronDown
          className={`h-3.5 w-3.5 text-[#5f6368] transition-transform duration-200 dark:text-[#94a3b8] ${
            isOpen ? 'rotate-180 text-[#1a73e8] dark:text-[#10b981]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu (opens upwards from input bar) */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Danh sách mô hình AI"
          className="absolute bottom-full left-0 z-50 mb-2 w-80 sm:w-96 origin-bottom-left rounded-2xl border border-[#dadce0] bg-white p-2.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 dark:border-[#23382d] dark:bg-[#131d18] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1f1f1f] dark:text-[#f1f5f9]">
              <Cpu className="h-3.5 w-3.5 text-[#1a73e8] dark:text-[#10b981]" />
              <span>Mô hình AI</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#5f6368] dark:text-[#94a3b8]">
              {isLoadingModels ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-[#1a73e8] dark:text-[#10b981]" />
                  <span>Đang tải...</span>
                </>
              ) : (
                <span>{models.length} mô hình</span>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5f6368] dark:text-[#94a3b8]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên hoặc ID..."
              className="w-full rounded-xl border border-[#dadce0] bg-[#f8fafd] py-1.5 pl-8 pr-7 text-xs text-[#1f1f1f] placeholder:text-[#5f6368] focus:border-[#1a73e8] focus:outline-hidden dark:border-[#23382d] dark:bg-[#16221d] dark:text-[#f1f5f9] dark:placeholder:text-[#94a3b8] dark:focus:border-[#10b981]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5f6368] hover:text-[#1f1f1f] dark:text-[#94a3b8] dark:hover:text-[#f1f5f9]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-[#1a73e8] text-white dark:bg-[#10b981] dark:text-[#101714]'
                  : 'bg-[#f0f4f9] text-[#5f6368] hover:bg-[#e1e3e1] dark:bg-[#16221d] dark:text-[#94a3b8] dark:hover:bg-[#1c2e26]'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('free')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                activeTab === 'free'
                  ? 'bg-[#1a73e8] text-white dark:bg-[#10b981] dark:text-[#101714]'
                  : 'bg-[#f0f4f9] text-[#5f6368] hover:bg-[#e1e3e1] dark:bg-[#16221d] dark:text-[#94a3b8] dark:hover:bg-[#1c2e26]'
              }`}
            >
              <Zap className="h-3 w-3" />
              <span>Miễn phí</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tools')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                activeTab === 'tools'
                  ? 'bg-[#1a73e8] text-white dark:bg-[#10b981] dark:text-[#101714]'
                  : 'bg-[#f0f4f9] text-[#5f6368] hover:bg-[#e1e3e1] dark:bg-[#16221d] dark:text-[#94a3b8] dark:hover:bg-[#1c2e26]'
              }`}
            >
              <Wrench className="h-3 w-3" />
              <span>Hỗ trợ Tool</span>
            </button>
          </div>

          {/* Model Options List */}
          <div className="max-h-60 overflow-y-auto pr-0.5 space-y-1">
            {filteredModels.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5f6368] dark:text-[#94a3b8]">
                <p>Không tìm thấy mô hình phù hợp.</p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectModel(searchQuery.trim());
                      setIsOpen(false);
                    }}
                    className="mt-2 text-xs font-medium text-[#1a73e8] underline dark:text-[#34d399]"
                  >
                    Dùng model &quot;{searchQuery.trim()}&quot;
                  </button>
                )}
              </div>
            ) : (
              filteredModels.map((model) => {
                const isSelected = model.id === selectedModel;
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectModel(model.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#103022] dark:text-[#34d399]'
                        : 'text-[#1f1f1f] hover:bg-[#f0f4f9] dark:text-[#f1f5f9] dark:hover:bg-[#1a2820]'
                    }`}
                  >
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 text-[#1a73e8] dark:text-[#10b981]" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-[#dadce0] dark:bg-[#23382d]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold">
                          {model.name}
                        </span>
                        <span className="text-[11px] text-[#5f6368] dark:text-[#94a3b8] shrink-0">
                          • {model.provider}
                        </span>

                        <div className="ml-auto flex items-center gap-1 shrink-0">
                          {model.supportsTools && (
                            <span
                              title="Hỗ trợ gọi hàm (Tool / Function calling)"
                              className="rounded-full bg-[#e8f0fe] px-1.5 py-0.2 text-[11px] text-[#1967d2] font-medium dark:bg-[#132c21] dark:text-[#34d399]"
                            >
                              Tools
                            </span>
                          )}
                          {model.badge && (
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[11px] font-semibold ${
                                model.isFree
                                  ? 'bg-[#e6f4ea] text-[#137333] dark:bg-[#064e3b] dark:text-[#a7f3d0]'
                                  : 'bg-[#fef7e0] text-[#b06000] dark:bg-[#332408] dark:text-[#fde047]'
                              }`}
                            >
                              {model.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-0.5 line-clamp-1 text-[11px] text-[#5f6368] dark:text-[#94a3b8]">
                        {model.id}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Custom Model Toggle / Form */}
          <div className="mt-1.5 border-t border-[#dadce0]/60 pt-1.5 dark:border-[#23382d]">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-1 text-xs font-medium text-[#1a73e8] hover:bg-[#f0f4f9] transition-colors dark:text-[#34d399] dark:hover:bg-[#1a2820]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nhập model AI tùy chỉnh...</span>
              </button>
            ) : (
              <form onSubmit={handleApplyCustom} className="space-y-1.5 p-1">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="VD: deepseek/deepseek-chat"
                  className="w-full rounded-lg border border-[#dadce0] bg-[#f8fafd] px-2.5 py-1.5 text-xs text-[#1f1f1f] placeholder:text-[#5f6368] focus:border-[#1a73e8] focus:outline-hidden dark:border-[#23382d] dark:bg-[#16221d] dark:text-[#f1f5f9] dark:placeholder:text-[#94a3b8] dark:focus:border-[#10b981]"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomInput('');
                    }}
                    className="rounded-lg px-2.5 py-1 text-xs text-[#5f6368] hover:bg-[#f0f4f9] dark:text-[#94a3b8] dark:hover:bg-[#1a2820]"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!customInput.trim()}
                    className="rounded-lg bg-[#1a73e8] px-3 py-1 text-xs font-medium text-white hover:bg-[#1557b0] disabled:opacity-50 dark:bg-[#059669] dark:hover:bg-[#047857]"
                  >
                    Áp dụng
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
