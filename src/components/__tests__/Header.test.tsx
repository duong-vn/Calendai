import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from '../Header';

describe('Header Component Mobile Responsiveness & Actions', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders app branding with header-app-name id and logo', () => {
    render(
      <Header
        user={null}
        isAuthenticated={false}
        isConfigured={true}
        onOpenUpcoming={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const appName = screen.getByText('Calendai');
    expect(appName).toBeInTheDocument();
    expect(appName).toHaveAttribute('id', 'header-app-name');
    expect(screen.getByAltText('Calendai Logo')).toBeInTheDocument();
  });

  it('renders privacy and terms links with hidden md:flex to avoid mobile header crowding', () => {
    render(
      <Header
        user={null}
        isAuthenticated={false}
        isConfigured={true}
        onOpenUpcoming={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const privacyLink = screen.getByTitle('Chính sách quyền riêng tư');
    const termsLink = screen.getByTitle('Điều khoản dịch vụ');

    expect(privacyLink).toHaveClass('hidden', 'md:flex');
    expect(termsLink).toHaveClass('hidden', 'md:flex');
  });

  it('fires callbacks on clicking tips and upcoming buttons', () => {
    const mockTips = vi.fn();
    const mockUpcoming = vi.fn();

    render(
      <Header
        user={null}
        isAuthenticated={false}
        isConfigured={true}
        onOpenTips={mockTips}
        onOpenUpcoming={mockUpcoming}
        onLogout={vi.fn()}
      />
    );

    const tipsButton = screen.getByTitle(/Xem mẹo đặt lịch/i);
    const upcomingButton = screen.getByTitle(/Xem lịch trình sắp tới/i);

    fireEvent.click(tipsButton);
    expect(mockTips).toHaveBeenCalledTimes(1);

    fireEvent.click(upcomingButton);
    expect(mockUpcoming).toHaveBeenCalledTimes(1);
  });

  it('renders authenticated user profile and fires onLogout', () => {
    const mockLogout = vi.fn();
    render(
      <Header
        user={{
          id: '123',
          email: 'test@example.com',
          name: 'Duong Nguyen',
          picture: 'https://example.com/avatar.jpg',
        }}
        isAuthenticated={true}
        isConfigured={true}
        onOpenUpcoming={vi.fn()}
        onLogout={mockLogout}
      />
    );

    expect(screen.getByAltText('Duong Nguyen')).toBeInTheDocument();
    const logoutBtn = screen.getByTitle('Đăng xuất');
    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('toggles theme between light and dark, updating html class and localStorage', () => {
    document.documentElement.classList.remove('dark');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(
      <Header
        user={null}
        isAuthenticated={false}
        isConfigured={true}
        onOpenUpcoming={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const themeBtn = screen.getByLabelText(/giao diện/i);
    expect(themeBtn).toBeInTheDocument();

    // Click to switch to dark mode
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(setItemSpy).toHaveBeenCalledWith('calendai_theme', 'dark');

    // Click again to switch back to light mode
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(setItemSpy).toHaveBeenCalledWith('calendai_theme', 'light');

    setItemSpy.mockRestore();
  });
});
