import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { NotFoundPage } from '../NotFoundPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('NotFoundPage', () => {
  it('renders 404 message', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('navigates to dashboard when clicking Go to Dashboard', async () => {
    const { user } = render(<NotFoundPage />);

    await user.click(screen.getByText('Go to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates back when clicking Go Back', async () => {
    const { user } = render(<NotFoundPage />);

    await user.click(screen.getByText('Go Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders helpful navigation links', () => {
    render(<NotFoundPage />);

    expect(screen.getByText('News Scanner')).toBeInTheDocument();
    expect(screen.getByText('FOIA Tracker')).toBeInTheDocument();
    expect(screen.getByText('Videos')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    render(<NotFoundPage />);
    expect(screen.getByText(/Press.*to search/i)).toBeInTheDocument();
  });
});
