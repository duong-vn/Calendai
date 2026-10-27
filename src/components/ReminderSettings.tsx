'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_REMINDER_MINUTES, readReminderSettings, REMINDER_SETTINGS_KEY, ReminderMinutesSchema } from '@/lib/calendar/reminders';

export function ReminderSettings() {
  const [values, setValues] = useState(() => DEFAULT_REMINDER_MINUTES.map(String));
  useEffect(() => { setValues(readReminderSettings().map(String)); }, []);
  const [message, setMessage] = useState('');
  const save = () => {
    const parsed = ReminderMinutesSchema.safeParse(values.map(value => value.trim() === '' ? NaN : Number(value)));
    if (!parsed.success) { setMessage('Nhập tối đa 5 mốc khác nhau, mỗi mốc là số phút nguyên từ 0 đến 40320.'); return; }
    try {
      localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(parsed.data));
      setMessage('Đã lưu. Áp dụng cho bản thảo mới xác nhận trên trình duyệt này.');
    } catch { setMessage('Không lưu được cài đặt. Vui lòng kiểm tra quyền lưu trữ của trình duyệt.'); }
  };
  const button = 'min-h-11 rounded-xl border-2 border-[#2d2015] px-3 py-2 text-sm font-semibold dark:border-[#453427]';
  return <details className="relative">
    <summary className="flex min-h-8 sm:min-h-[34px] cursor-pointer items-center rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-2.5 py-0.5 text-xs font-bold shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427]">Cài đặt</summary>
    <section aria-label="Cài đặt nhắc lịch" className="fixed inset-x-4 bottom-20 z-40 max-h-[70dvh] space-y-3 overflow-y-auto rounded-2xl border-2 border-[#2d2015] bg-[#fffaf2] p-4 text-[#2b1f17] shadow-lg sm:absolute sm:inset-auto sm:bottom-full sm:right-0 sm:mb-2 sm:w-72 sm:max-w-[calc(100vw-2rem)] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9]">
      <h3 className="font-bold">Nhắc lịch Google Calendar</h3>
      <p className="text-xs">Số phút trước giờ bắt đầu. Mặc định: 60 phút và 10 phút. Chỉ áp dụng khi xác nhận bản thảo mới, không đổi lịch đã tạo hoặc bản thảo đang thử lại.</p>
      {values.map((value, index) => <div key={index} className="flex items-end gap-2">
        <label className="grid min-w-0 flex-1 gap-1 text-xs">Nhắc trước (phút) {index + 1}<input type="number" min="0" max="40320" step="1" value={value} onChange={event => setValues(current => current.map((item, i) => i === index ? event.target.value : item))} className="min-h-11 min-w-0 rounded-lg border border-current bg-transparent px-2 text-base" /></label>
        <button type="button" aria-label={`Bỏ mốc nhắc ${index + 1}`} className={button} onClick={() => setValues(current => current.filter((_, i) => i !== index))}>Bỏ</button>
      </div>)}
      {values.length === 0 && <p className="text-xs">Không nhắc lịch.</p>}
      <div className="flex flex-wrap gap-2">
        {values.length < 5 && <button type="button" className={button} onClick={() => setValues(current => [...current, ''])}>Thêm mốc</button>}
        <button type="button" className={button} onClick={() => setValues(DEFAULT_REMINDER_MINUTES.map(String))}>Khôi phục mặc định</button>
        <button type="button" className={`${button} bg-[#c25e2e] text-white dark:bg-[#e07a3f] dark:text-[#14110f]`} onClick={save}>Lưu cài đặt</button>
      </div>
      {!!message && <p role="status" className="text-xs">{message}</p>}
      <p className="text-xs">Âm thanh phụ thuộc cài đặt thông báo Google Calendar trên thiết bị. Cài đặt này không đồng bộ sang thiết bị khác.</p>
    </section>
  </details>;
}
