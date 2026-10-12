import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIModelOption } from '@/lib/ai/models';
import { ModelSelector } from '../ModelSelector';

const MOCK_MODELS: AIModelOption[] = [
  {
    id: 'provider/primary-model',
    name: 'Primary Model',
    provider: 'Provider',
    badge: 'Mặc định',
    isFree: true,
    supportsTools: true,
    description: 'Mô hình chính',
  },
  {
    id: 'provider/fast-model',
    name: 'Fast Model',
    provider: 'Provider',
    badge: 'Free',
    isFree: true,
    supportsTools: true,
    description: 'Mô hình tốc độ cao',
  },
];

describe('ModelSelector Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          models: MOCK_MODELS,
        }),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders active model pill with name', async () => {
    render(
      <ModelSelector
        selectedModel="provider/primary-model"
        onSelectModel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('primary-model')).toBeInTheDocument();
    });
  });

  it('toggles dropdown menu on click and lists models from API', async () => {
    render(
      <ModelSelector
        selectedModel="provider/primary-model"
        onSelectModel={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /chọn mô hình ai/i });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Primary Model')).toBeInTheDocument();
    expect(within(listbox).getByText('Fast Model')).toBeInTheDocument();

    // Click again to close
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('calls onSelectModel when choosing another model from list', async () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelector
        selectedModel="provider/primary-model"
        onSelectModel={handleSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /chọn mô hình ai/i });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const fastOption = screen.getByRole('option', { name: /fast model/i });
    fireEvent.click(fastOption);

    expect(handleSelect).toHaveBeenCalledWith('provider/fast-model');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('allows applying a custom model id', async () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelector
        selectedModel="provider/primary-model"
        onSelectModel={handleSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /chọn mô hình ai/i });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const customBtn = screen.getByText(/Nhập model AI/i);
    fireEvent.click(customBtn);

    const input = screen.getByPlaceholderText(/deepseek/i);
    fireEvent.change(input, { target: { value: 'custom/model-x' } });

    const applyBtn = screen.getByRole('button', { name: 'Áp dụng' });
    fireEvent.click(applyBtn);

    expect(handleSelect).toHaveBeenCalledWith('custom/model-x');
  });

  it('filters models via search input', async () => {
    render(
      <ModelSelector
        selectedModel="provider/primary-model"
        onSelectModel={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /chọn mô hình ai/i });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const listbox = screen.getByRole('listbox');
    const searchInput = screen.getByPlaceholderText('Tìm kiếm theo tên hoặc ID...');
    fireEvent.change(searchInput, { target: { value: 'fast' } });

    expect(within(listbox).getByText('Fast Model')).toBeInTheDocument();
    expect(within(listbox).queryByText('Primary Model')).not.toBeInTheDocument();
  });

  it('closes dropdown when pressing Escape key', async () => {
    render(
      <ModelSelector
        selectedModel="provider/primary-model"
        onSelectModel={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /chọn mô hình ai/i });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
