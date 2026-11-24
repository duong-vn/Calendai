import { describe, expect, it } from 'vitest';
import { safeHttpsUrl, safeMarkdownUrl } from '../links';

describe('Web external & Markdown URL validation (links.ts)', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'http://meet.google.com/abc-defg-hij',
    'http://calendar.google.com/calendar/event?eid=123',
    'https://user:pass@meet.google.com/abc-defg-hij',
    'https://user@meet.google.com/abc-defg-hij',
    'https://:pass@calendar.google.com/calendar/event?eid=123',
    '//meet.google.com/abc-defg-hij',
    '/relative/path',
    '',
    '   ',
  ])('rejects unsafe or credentialed URL %j across all link kinds', (input) => {
    expect(safeHttpsUrl(input, 'any')).toBeNull();
    expect(safeHttpsUrl(input, 'meet')).toBeNull();
    expect(safeHttpsUrl(input, 'calendar')).toBeNull();
  });

  it('handles nullish inputs safely without throwing', () => {
    expect(safeHttpsUrl(undefined, 'meet')).toBeNull();
    expect(safeHttpsUrl(null, 'calendar')).toBeNull();
    expect(safeMarkdownUrl(undefined)).toBeNull();
    expect(safeMarkdownUrl(null)).toBeNull();
  });

  it('allows only https://meet.google.com without custom port or credentials for meet links', () => {
    expect(safeHttpsUrl('https://meet.google.com/abc-defg-hij', 'meet')).toBe(
      'https://meet.google.com/abc-defg-hij'
    );
    expect(safeHttpsUrl('https://meet.google.com.evil.test/path', 'meet')).toBeNull();
    expect(safeHttpsUrl('https://sub.meet.google.com/path', 'meet')).toBeNull();
    expect(safeHttpsUrl('https://meet.google.com:8443/abc-defg-hij', 'meet')).toBeNull();
    expect(safeHttpsUrl('https://calendar.google.com/event?eid=1', 'meet')).toBeNull();
  });

  it('allows only calendar.google.com and www.google.com without custom port or credentials for calendar links', () => {
    expect(safeHttpsUrl('https://calendar.google.com/calendar/event?eid=123', 'calendar')).toBe(
      'https://calendar.google.com/calendar/event?eid=123'
    );
    expect(safeHttpsUrl('https://www.google.com/calendar/event?eid=123', 'calendar')).toBe(
      'https://www.google.com/calendar/event?eid=123'
    );
    expect(safeHttpsUrl('https://calendar.google.com.evil.test/event', 'calendar')).toBeNull();
    expect(safeHttpsUrl('https://docs.google.com/document/d/1', 'calendar')).toBeNull();
    expect(safeHttpsUrl('https://calendar.google.com:8443/event', 'calendar')).toBeNull();
  });

  it('restricts Markdown links to safe https (without credentials) and valid mailto URLs', () => {
    expect(safeMarkdownUrl('https://docs.example.com/guide?tab=1')).toBe(
      'https://docs.example.com/guide?tab=1'
    );
    expect(safeMarkdownUrl('mailto:partner@company.com')).toBe('mailto:partner@company.com');
    expect(safeMarkdownUrl('mailto:partner@company.com?subject=Hop%20nhom')).toBe(
      'mailto:partner@company.com?subject=Hop%20nhom'
    );

    expect(safeMarkdownUrl('javascript:alert(1)')).toBeNull();
    expect(safeMarkdownUrl('data:text/html,hello')).toBeNull();
    expect(safeMarkdownUrl('http://example.com/insecure')).toBeNull();
    expect(safeMarkdownUrl('https://user:pass@example.com/secret')).toBeNull();
    expect(safeMarkdownUrl('mailto:')).toBeNull();
    expect(safeMarkdownUrl('mailto:?subject=empty')).toBeNull();
    expect(safeMarkdownUrl('mailto://evil.example/phish')).toBeNull();
    expect(safeMarkdownUrl('/api/auth/google/logout')).toBeNull();
  });
});
