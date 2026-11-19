import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@/test/utils';
import { LoginPage } from '../LoginPage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// Parked (2026-11-19): with no backend answering, the page says so instead of a sign-in that cannot work.
describe('LoginPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows "Parked. Back later." and no form when the backend does not answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<LoginPage />);
    expect(await screen.findByText('Parked. Back later.')).toBeInTheDocument();
    expect(screen.queryByText('Sign In')).toBeNull();
  });

  it('a backend that answers an error is parked too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Application not found', { status: 404 })));
    render(<LoginPage />);
    expect(await screen.findByText('Parked. Back later.')).toBeInTheDocument();
  });

  it('shows the sign-in form when the backend is healthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 })));
    render(<LoginPage />);
    expect(await screen.findByText('Sign In')).toBeInTheDocument();
    expect(screen.queryByText('Parked. Back later.')).toBeNull();
  });

  it('links the privacy page and uses no em dash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { container } = render(<LoginPage />);
    await screen.findByText('Parked. Back later.');
    expect(screen.getByText('Privacy').closest('a')).toHaveAttribute('href', '/privacy.html');
    expect(container.textContent).not.toMatch(/—/);
  });
});
