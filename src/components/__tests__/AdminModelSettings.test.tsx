import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminModelSettings } from '../AdminModelSettings';

describe('AdminModelSettings', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads provider models, blocks duplicate primary/fallback, and saves valid config via POST /api/admin/config', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/models') {
        return Response.json({
          success: true,
          defaultModel: 'openai/gpt-4o-mini',
          models: [
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', supportsTools: true, isFree: false, description: '' },
            { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', supportsTools: true, isFree: false, description: '' },
            { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'google', supportsTools: true, isFree: true, description: '' },
          ],
        });
      }
      if (url === '/api/admin/config' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return Response.json({
          success: true,
          primaryModel: body.primaryModel,
          fallbackModel: body.fallbackModel,
          updatedAt: '2026-11-26T14:00:00.000Z',
          updatedBy: 'admin@example.com',
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AdminModelSettings
        initialPrimaryModel="openai/gpt-4o-mini"
        initialFallbackModel={null}
      />
    );

    const primarySelect = await screen.findByLabelText('Model chính');
    const fallbackSelect = screen.getByLabelText('Model dự phòng (Fallback)');
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: /GPT-4o \(openai\/gpt-4o\)/ })).toHaveLength(2);
    });

    // Selecting identical primary and fallback shows validation error without calling POST
    fireEvent.change(primarySelect, { target: { value: 'openai/gpt-4o' } });
    fireEvent.change(fallbackSelect, { target: { value: 'openai/gpt-4o' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Model chính và model dự phòng không được trùng nhau.'
    );
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/admin/config')).toHaveLength(0);

    // Selecting distinct fallback succeeds and displays success message
    fireEvent.change(fallbackSelect, { target: { value: 'google/gemini-2.0-flash-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Đã lưu cấu hình model AI thành công và áp dụng ngay.'
    );
    const postCall = fetchMock.mock.calls.find(([u]) => u === '/api/admin/config');
    expect(postCall).toBeDefined();
    expect(JSON.parse(String(postCall![1]?.body))).toEqual({
      primaryModel: 'openai/gpt-4o',
      fallbackModel: 'google/gemini-2.0-flash-001',
    });
  });

  it('surfaces server validation error messages when POST /api/admin/config rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/models') {
          return Response.json({
            success: true,
            defaultModel: 'openai/gpt-4o-mini',
            models: [
              { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', supportsTools: true, description: '' },
            ],
          });
        }
        if (url === '/api/admin/config') {
          return Response.json(
            { error: 'Model chính không nằm trong danh sách được nhà cung cấp hỗ trợ.' },
            { status: 400 }
          );
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      })
    );

    render(
      <AdminModelSettings
        initialPrimaryModel="openai/gpt-4o-mini"
        initialFallbackModel={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lưu cấu hình' })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Model chính không nằm trong danh sách được nhà cung cấp hỗ trợ.'
    );
  });

  it('deduplicates filtered extras when primaryModel equals fallbackModel', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/models') {
          return Response.json({
            success: true,
            defaultModel: 'openai/gpt-4o-mini',
            models: [
              { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', supportsTools: true, isFree: false, description: '' },
              { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', supportsTools: true, isFree: false, description: '' },
            ],
          });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      })
    );

    try {
      render(
        <AdminModelSettings
          initialPrimaryModel="openai/gpt-4o"
          initialFallbackModel="openai/gpt-4o"
        />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('option', { name: /GPT-4o \(openai\/gpt-4o\)/ })).toHaveLength(2);
      });

      const searchInput = screen.getByLabelText('Lọc nhanh danh sách model');
      fireEvent.change(searchInput, { target: { value: 'nonexistent-query' } });

      const primarySelect = screen.getByLabelText('Model chính') as HTMLSelectElement;
      const fallbackSelect = screen.getByLabelText('Model dự phòng (Fallback)') as HTMLSelectElement;
      expect(
        Array.from(primarySelect.options).filter((o) => o.value === 'openai/gpt-4o')
      ).toHaveLength(1);
      expect(
        Array.from(fallbackSelect.options).filter((o) => o.value === 'openai/gpt-4o')
      ).toHaveLength(1);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('formats updatedAt consistently in Vietnam timezone and guards invalid timestamps', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          defaultModel: 'openai/gpt-4o-mini',
          models: [
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', supportsTools: true, isFree: false, description: '' },
          ],
        })
      )
    );

    const view = render(
      <AdminModelSettings
        initialPrimaryModel="openai/gpt-4o-mini"
        initialFallbackModel={null}
        initialUpdatedAt="2026-11-26T00:00:00.000Z"
        initialUpdatedBy="admin@example.com"
      />
    );

    const expectedFormatted = new Date('2026-11-26T00:00:00.000Z').toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    expect(screen.getByText(/Cập nhật lần cuối:/)).toHaveTextContent(expectedFormatted);
    expect(screen.getByText(/Cập nhật lần cuối:/)).toHaveTextContent('07:00');
    view.unmount();

    render(
      <AdminModelSettings
        initialPrimaryModel="openai/gpt-4o-mini"
        initialFallbackModel={null}
        initialUpdatedAt="not-a-date"
      />
    );
    expect(screen.getByText(/Cập nhật lần cuối:/)).toHaveTextContent('Cập nhật lần cuối: —');
    expect(screen.getByText(/Cập nhật lần cuối:/)).not.toHaveTextContent('Invalid Date');
  });
});
