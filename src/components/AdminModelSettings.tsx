'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Info,
  Loader2,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { AIModelOption } from '@/lib/ai/models';
import { VIETNAM_TIME_ZONE } from '@/lib/calendar/date-range';

function formatUpdatedAt(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { timeZone: VIETNAM_TIME_ZONE });
}

interface AdminModelSettingsProps {
  initialPrimaryModel: string;
  initialFallbackModel: string | null;
  initialUpdatedAt?: string;
  initialUpdatedBy?: string;
  envLoadError?: string;
}

export function AdminModelSettings({
  initialPrimaryModel,
  initialFallbackModel,
  initialUpdatedAt,
  initialUpdatedBy,
  envLoadError,
}: AdminModelSettingsProps) {
  const [models, setModels] = useState<AIModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [primaryModel, setPrimaryModel] = useState(initialPrimaryModel);
  const [fallbackModel, setFallbackModel] = useState(initialFallbackModel ?? '');
  const [savedConfig, setSavedConfig] = useState({
    primaryModel: initialPrimaryModel,
    fallbackModel: initialFallbackModel,
    updatedAt: initialUpdatedAt,
    updatedBy: initialUpdatedBy,
  });

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    envLoadError ? { type: 'error', message: envLoadError } : null
  );

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    setCatalogError('');
    try {
      const res = await fetch('/api/models');
      const data = (await res.json()) as {
        success?: boolean;
        models?: AIModelOption[];
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.models) || data.models.length === 0) {
        setCatalogError('Không thể tải danh sách model từ nhà cung cấp AI.');
        setModels([]);
        return;
      }
      setModels(data.models);
      if (data.success === false) {
        setCatalogError(
          'Không lấy được toàn bộ danh mục từ nhà cung cấp AI; chỉ hiển thị model mặc định hiện tại.'
        );
      }
    } catch {
      setCatalogError('Không thể tải danh sách model từ nhà cung cấp AI.');
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q)
        )
      : models;

    // Always keep currently selected values selectable even when filtering
    const extras: AIModelOption[] = [];
    for (const selectedId of [primaryModel, fallbackModel]) {
      if (
        selectedId &&
        !base.some((m) => m.id === selectedId) &&
        !extras.some((m) => m.id === selectedId)
      ) {
        const known = models.find((m) => m.id === selectedId);
        if (known) {
          extras.push(known);
        } else {
          extras.push({
            id: selectedId,
            name: selectedId,
            provider: selectedId.includes('/') ? selectedId.split('/')[0] : 'AI',
            description: `Mô hình ${selectedId}`,
          });
        }
      }
    }
    return [...extras, ...base];
  }, [models, searchQuery, primaryModel, fallbackModel]);

  const formatOptionLabel = (model: AIModelOption) => {
    const tags: string[] = [];
    if (model.supportsTools) tags.push('Hỗ trợ công cụ');
    if (model.isFree) tags.push('Free');
    return tags.length > 0
      ? `${model.name} (${model.id}) — ${tags.join(', ')}`
      : `${model.name} (${model.id})`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedPrimary = primaryModel.trim();
    const trimmedFallback = fallbackModel.trim() || null;

    if (!trimmedPrimary) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn model chính.' });
      return;
    }

    if (trimmedFallback && trimmedFallback === trimmedPrimary) {
      setFeedback({
        type: 'error',
        message: 'Model chính và model dự phòng không được trùng nhau.',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryModel: trimmedPrimary,
          fallbackModel: trimmedFallback,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        primaryModel?: string;
        fallbackModel?: string | null;
        updatedAt?: string;
        updatedBy?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setFeedback({
          type: 'error',
          message: data.error || 'Không thể lưu cấu hình model. Vui lòng thử lại.',
        });
        return;
      }

      const nextPrimary = data.primaryModel ?? trimmedPrimary;
      const nextFallback = data.fallbackModel ?? null;
      setPrimaryModel(nextPrimary);
      setFallbackModel(nextFallback ?? '');
      setSavedConfig({
        primaryModel: nextPrimary,
        fallbackModel: nextFallback,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      });
      setFeedback({
        type: 'success',
        message: 'Đã lưu cấu hình model AI thành công và áp dụng ngay.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Lỗi kết nối khi lưu cấu hình. Vui lòng thử lại.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#2d2015]/20 dark:border-[#453427] pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2d2015] bg-[#ede4d5] text-[#1f7560] shadow-[2px_2px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#2dd4bf] dark:shadow-[2px_2px_0px_#453427]">
            <SlidersHorizontal className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#c25e2e] dark:text-[#e07a3f]">
              Quản trị hệ thống
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#2b1f17] dark:text-[#f5ebd9]">
              Cấu hình Model AI &amp; Dự phòng
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadModels();
          }}
          disabled={loadingModels}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border-2 border-[#2d2015] bg-[#fffaf2] px-3.5 py-2 text-xs font-bold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] disabled:opacity-60 dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
          <span>Tải lại danh sách model</span>
        </button>
      </div>

      {/* Current Active Summary */}
      <div className="rounded-2xl border-2 border-[#2d2015]/30 bg-[#ede4d5]/50 p-4 text-xs sm:text-sm dark:border-[#453427] dark:bg-[#1a1511]">
        <div className="flex items-center gap-2 font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
          <Cpu className="h-4 w-4 text-[#c25e2e] dark:text-[#e07a3f]" />
          <span>Cấu hình đang hoạt động</span>
        </div>
        <dl className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-mono uppercase text-[#786455] dark:text-[#ba9f88]">
              Model chính
            </dt>
            <dd className="mt-0.5 font-mono font-semibold text-[#2b1f17] dark:text-[#f5ebd9]">
              {savedConfig.primaryModel || '(Chưa cấu hình)'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-mono uppercase text-[#786455] dark:text-[#ba9f88]">
              Model dự phòng (Fallback)
            </dt>
            <dd className="mt-0.5 font-mono font-semibold text-[#2b1f17] dark:text-[#f5ebd9]">
              {savedConfig.fallbackModel || 'Không dùng model dự phòng'}
            </dd>
          </div>
        </dl>
        {(savedConfig.updatedAt || savedConfig.updatedBy) && (
          <p className="mt-2.5 text-[11px] text-[#786455] dark:text-[#ba9f88]">
            Cập nhật lần cuối: {formatUpdatedAt(savedConfig.updatedAt)}
            {savedConfig.updatedBy ? ` bởi ${savedConfig.updatedBy}` : ''}
          </p>
        )}
      </div>

      {/* Feedback & Catalog Warnings */}
      {catalogError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border-2 border-[#d49439] bg-[#fef9ec] p-3.5 text-xs sm:text-sm text-[#8a5a14] dark:border-[#fbbf24] dark:bg-[#2a2110] dark:text-[#fde68a]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{catalogError}</span>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-2xl border-2 p-3.5 text-xs sm:text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-[#2d8a57] bg-[#f0f9f4] text-[#1f7560] dark:border-[#2dd4bf] dark:bg-[#14261d] dark:text-[#34d399]'
              : 'border-[#cf3e32] bg-[#fdf2f0] text-[#a63024] dark:border-[#ef4444] dark:bg-[#2b1614] dark:text-[#f87171]'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Selection Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="admin-model-search"
            className="block text-xs font-bold text-[#2b1f17] dark:text-[#f5ebd9]"
          >
            Lọc nhanh danh sách model
          </label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#786455] dark:text-[#ba9f88]" />
            <input
              id="admin-model-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, ID hoặc nhà cung cấp..."
              className="min-h-11 w-full rounded-xl border-2 border-[#2d2015] bg-[#fffaf2] py-2 pl-9 pr-3 text-sm text-[#2b1f17] focus:border-[#c25e2e] focus:outline-none dark:border-[#453427] dark:bg-[#181310] dark:text-[#f5ebd9] dark:focus:border-[#e07a3f]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-primary-model"
            className="block text-sm font-bold text-[#2b1f17] dark:text-[#f5ebd9]"
          >
            Model chính
          </label>
          <p className="mt-0.5 text-xs text-[#786455] dark:text-[#ba9f88]">
            Dùng cho toàn bộ hội thoại web, mobile và kiểm tra sức khỏe AI (`/api/health/ai/probe`).
          </p>
          <select
            id="admin-primary-model"
            value={primaryModel}
            onChange={(e) => setPrimaryModel(e.target.value)}
            disabled={loadingModels && filteredModels.length === 0}
            className="mt-2 min-h-11 w-full rounded-xl border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-2 text-sm text-[#2b1f17] focus:border-[#c25e2e] focus:outline-none dark:border-[#453427] dark:bg-[#181310] dark:text-[#f5ebd9] dark:focus:border-[#e07a3f]"
          >
            {filteredModels.map((model) => (
              <option key={model.id} value={model.id}>
                {formatOptionLabel(model)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="admin-fallback-model"
            className="block text-sm font-bold text-[#2b1f17] dark:text-[#f5ebd9]"
          >
            Model dự phòng (Fallback)
          </label>
          <p className="mt-0.5 text-xs text-[#786455] dark:text-[#ba9f88]">
            Tự động thử lại đúng một lần khi model chính gặp lỗi 5xx, 429 hoặc quá thời gian chờ.
          </p>
          <select
            id="admin-fallback-model"
            value={fallbackModel}
            onChange={(e) => setFallbackModel(e.target.value)}
            disabled={loadingModels && filteredModels.length === 0}
            className="mt-2 min-h-11 w-full rounded-xl border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-2 text-sm text-[#2b1f17] focus:border-[#c25e2e] focus:outline-none dark:border-[#453427] dark:bg-[#181310] dark:text-[#f5ebd9] dark:focus:border-[#e07a3f]"
          >
            <option value="">Không dùng model dự phòng</option>
            {filteredModels.map((model) => (
              <option key={model.id} value={model.id}>
                {formatOptionLabel(model)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || loadingModels}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#2d2015] bg-[#c25e2e] px-5 py-2.5 text-sm font-bold text-white shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#a6491e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-60 dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f] dark:shadow-[2px_2px_0px_#453427]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang lưu cấu hình...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Lưu cấu hình</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Ephemeral Filesystem Notice */}
      <div className="rounded-2xl border-2 border-[#1f7560]/50 bg-[#1f7560]/10 p-4 text-xs leading-relaxed text-[#2b1f17] dark:border-[#2dd4bf]/40 dark:bg-[#2dd4bf]/10 dark:text-[#f5ebd9]">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1f7560] dark:text-[#2dd4bf]" />
          <div>
            <p className="font-bold text-[#1f7560] dark:text-[#2dd4bf]">
              Lưu ý về môi trường Vercel (Ephemeral Filesystem)
            </p>
            <p className="mt-1">
              Cấu hình được lưu trong tệp JSON trên máy chủ và giữ trong bộ nhớ tiến trình để có hiệu lực ngay không cần deploy lại. Trên nền tảng serverless như Vercel, hệ thống tệp là tạm thời (ephemeral) nên cấu hình có thể quay về giá trị mặc định trong biến môi trường (<code className="font-mono">AI_MODEL</code> / <code className="font-mono">AI_FALLBACK_MODEL</code>) sau mỗi lần deploy mới hoặc khi instance khởi động lại.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
