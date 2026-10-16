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

  // Fetch live AI models on demand when opened or when default model is needed
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

    if (isOpen || !selectedModel) {
      fetchModels();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, hasFetched, selectedModel, onSelectModel]);

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
        className="group flex min-h-[30px] sm:min-h-[34px] touch-manipulation items-center gap-1 sm:gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-bold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
      >
        <div className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full text-[#c25e2e] dark:text-[#e07a3f] shrink-0">
          {currentModel.isFree ? (
            <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#1f7560] dark:text-[#2dd4bf]" />
          ) : (
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#d49439] dark:text-[#fbbf24]" />
          )}
        </div>

        <span className="max-w-[70px] xs:max-w-[100px] sm:max-w-[150px] md:max-w-[180px] truncate text-[11px] sm:text-xs">
          {currentModel.name || 'Mô hình AI'}
        </span>

        {currentModel.badge && (
          <span
            className={`hidden xs:inline-block rounded-full px-1.5 py-0.2 text-[11px] font-bold border shrink-0 ${
              currentModel.isFree
                ? 'bg-[#f0f9f4] text-[#1f7560] border-[#2d2015] dark:bg-[#152a1f] dark:text-[#2dd4bf] dark:border-[#453427]'
                : 'bg-[#fffaf2] text-[#d49439] border-[#2d2015] dark:bg-[#211a14] dark:text-[#fbbf24] dark:border-[#453427]'
            }`}
          >
            {currentModel.badge}
          </span>
        )}

        <ChevronDown
          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#786455] transition-transform duration-200 dark:text-[#ba9f88] shrink-0 ${
            isOpen ? 'rotate-180 text-[#c25e2e] dark:text-[#e07a3f]' : ''
          }`}
        />
      </button>

      {/* Responsive Modal/Dropdown Container (Bottom Sheet on mobile, Anchored Dropdown on desktop) */}
      {isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:mt-2 sm:block sm:bg-transparent sm:backdrop-blur-none sm:p-0 animate-in fade-in duration-150"
        >
          <div
            role="listbox"
            aria-label="Danh sách mô hình AI"
            className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[#fffaf2] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl border-2 border-[#2d2015] overflow-hidden sm:max-h-none sm:w-84 sm:w-96 sm:rounded-2xl sm:p-3 sm:pb-3 sm:shadow-[4px_4px_0px_#2d2015] dark:bg-[#1f1813] dark:border-[#453427] dark:sm:shadow-[4px_4px_0px_#453427]"
          >
            {/* Mobile Drag Handle */}
            <div className="w-10 h-1 bg-[#2d2015]/40 dark:bg-[#453427] rounded-full mx-auto mb-2.5 shrink-0 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between px-1 pb-2.5 sm:pb-2 border-b-2 border-[#2d2015]/20 dark:border-[#453427]">
              <div className="flex items-center gap-1.5 text-sm sm:text-xs font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                <Cpu className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#c25e2e] dark:text-[#e07a3f]" />
                <span>Mô hình AI Hơi Nước</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs sm:text-[11px] font-semibold text-[#786455] dark:text-[#ba9f88]">
                  {isLoadingModels ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-[#c25e2e] dark:text-[#e07a3f]" />
                      <span>Đang tải...</span>
                    </>
                  ) : (
                    <span>{models.length} mô hình</span>
                  )}
                </div>
                {/* Mobile close button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-1 text-[#786455] hover:bg-[#ede4d5] sm:hidden dark:text-[#ba9f88] dark:hover:bg-[#2a221b]"
                  aria-label="Đóng chọn mô hình"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative my-2.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#786455] dark:text-[#ba9f88]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên hoặc ID..."
                className="w-full rounded-xl border-2 border-[#2d2015]/40 bg-[#f5eee1] py-1.5 pl-8 pr-7 text-xs font-medium text-[#2b1f17] placeholder:text-[#786455] focus:border-[#c25e2e] focus:outline-hidden dark:border-[#453427] dark:bg-[#16120f] dark:text-[#f5ebd9] dark:placeholder:text-[#ba9f88] dark:focus:border-[#e07a3f]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#786455] hover:text-[#2b1f17] dark:text-[#ba9f88] dark:hover:text-[#f5ebd9]"
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
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border-2 transition-all ${
                  activeTab === 'all'
                    ? 'border-[#2d2015] bg-[#c25e2e] text-white shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]'
                    : 'border-[#2d2015]/30 bg-[#ede4d5] text-[#786455] hover:bg-[#e3d7c3] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#ba9f88]'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('free')}
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border-2 transition-all ${
                  activeTab === 'free'
                    ? 'border-[#2d2015] bg-[#c25e2e] text-white shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]'
                    : 'border-[#2d2015]/30 bg-[#ede4d5] text-[#786455] hover:bg-[#e3d7c3] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#ba9f88]'
                }`}
              >
                <Zap className="h-3 w-3" />
                <span>Miễn phí</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border-2 transition-all ${
                  activeTab === 'tools'
                    ? 'border-[#2d2015] bg-[#c25e2e] text-white shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]'
                    : 'border-[#2d2015]/30 bg-[#ede4d5] text-[#786455] hover:bg-[#e3d7c3] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#ba9f88]'
                }`}
              >
                <Wrench className="h-3 w-3" />
                <span>Tools</span>
              </button>
            </div>

            {/* Model Options List */}
            <div className="max-h-60 overflow-y-auto pr-0.5 space-y-1">
              {filteredModels.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#786455] dark:text-[#ba9f88]">
                  <p>Không tìm thấy mô hình phù hợp.</p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectModel(searchQuery.trim());
                        setIsOpen(false);
                      }}
                      className="mt-2 text-xs font-bold text-[#c25e2e] underline dark:text-[#e07a3f]"
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
                      className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-all ${
                        isSelected
                          ? 'border border-[#2d2015] bg-[#ede4d5] text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2c221a] dark:text-[#e07a3f]'
                          : 'text-[#2b1f17] hover:bg-[#f5eee1] dark:text-[#f5ebd9] dark:hover:bg-[#261f18]'
                      }`}
                    >
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f]" />
                        ) : (
                          <div className="h-2 w-2 rounded-full border border-[#2d2015]/40 bg-[#ede4d5] dark:border-[#453427] dark:bg-[#2a221b]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold">
                            {model.name}
                          </span>
                          <span className="text-[11px] text-[#786455] dark:text-[#ba9f88] shrink-0 font-mono">
                            • {model.provider}
                          </span>

                          <div className="ml-auto flex items-center gap-1 shrink-0">
                            {model.supportsTools && (
                              <span
                                title="Hỗ trợ gọi hàm (Tool / Function calling)"
                                className="rounded-full border border-[#2d2015]/40 bg-[#fffaf2] px-1.5 py-0.2 text-[11px] font-mono text-[#1f7560] font-bold dark:border-[#453427] dark:bg-[#16120f] dark:text-[#2dd4bf]"
                              >
                                Tools
                              </span>
                            )}
                            {model.badge && (
                              <span
                                className={`rounded-full px-1.5 py-0.2 text-[11px] font-bold border ${
                                  model.isFree
                                    ? 'bg-[#f0f9f4] text-[#1f7560] border-[#2d2015] dark:bg-[#152a1f] dark:text-[#2dd4bf] dark:border-[#453427]'
                                    : 'bg-[#fffaf2] text-[#d49439] border-[#2d2015] dark:bg-[#211a14] dark:text-[#fbbf24] dark:border-[#453427]'
                                }`}
                              >
                                {model.badge}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="mt-0.5 line-clamp-1 text-[11px] font-mono text-[#786455] dark:text-[#ba9f88]">
                          {model.id}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Custom Model Toggle / Form */}
            <div className="mt-1.5 border-t-2 border-[#2d2015]/20 pt-1.5 dark:border-[#453427]">
              {!showCustomInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-1 text-xs font-bold text-[#c25e2e] hover:bg-[#ede4d5] transition-colors dark:text-[#e07a3f] dark:hover:bg-[#261f18]"
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
                    className="w-full rounded-lg border-2 border-[#2d2015]/40 bg-[#f5eee1] px-2.5 py-1.5 text-xs font-mono text-[#2b1f17] placeholder:text-[#786455] focus:border-[#c25e2e] focus:outline-hidden dark:border-[#453427] dark:bg-[#16120f] dark:text-[#f5ebd9] dark:placeholder:text-[#ba9f88] dark:focus:border-[#e07a3f]"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomInput('');
                      }}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[#786455] hover:bg-[#ede4d5] dark:text-[#ba9f88] dark:hover:bg-[#261f18]"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={!customInput.trim()}
                      className="rounded-lg border-2 border-[#2d2015] bg-[#c25e2e] px-3 py-1 text-xs font-bold text-white shadow-[1px_1px_0px_#2d2015] hover:bg-[#a6491e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]"
                    >
                      Áp dụng
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
