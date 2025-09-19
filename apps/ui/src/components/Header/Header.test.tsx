import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  it('renders the Harbourmaster title', () => {
    render(<Header />);
    expect(screen.getByText('Harbourmaster')).toBeInTheDocument();
  });

  it('renders the logo icon', () => {
    const { container } = render(<Header />);
    const logoIcon = container.querySelector('svg');
    expect(logoIcon).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Header />);

    expect(screen.getByText('Containers')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Volumes')).toBeInTheDocument();
    expect(screen.getByText('Networks')).toBeInTheDocument();
  });

  it('renders system status indicator', () => {
    render(<Header />);

    expect(screen.getByText('Online')).toBeInTheDocument();

    const statusDot = document.querySelector('.bg-success-400');
    expect(statusDot).toBeInTheDocument();
    expect(statusDot).toHaveClass('w-2', 'h-2', 'rounded-full');
  });

  it('renders logout button by default', () => {
    render(<Header />);
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('does not render logout button when showLogout is false', () => {
    render(<Header showLogout={false} />);
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('calls onLogout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const mockLogout = vi.fn();

    render(<Header onLogout={mockLogout} />);

    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders navigation links with correct hrefs', () => {
    render(<Header />);

    expect(screen.getByText('Containers').closest('a')).toHaveAttribute('href', '/');
    expect(screen.getByText('Images').closest('a')).toHaveAttribute('href', '/images');
    expect(screen.getByText('Volumes').closest('a')).toHaveAttribute('href', '/volumes');
    expect(screen.getByText('Networks').closest('a')).toHaveAttribute('href', '/networks');
  });

  it('applies correct styling classes', () => {
    const { container } = render(<Header />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('bg-white', 'border-b', 'border-neutral-200', 'shadow-sm');
  });

  it('has proper responsive classes for navigation', () => {
    render(<Header />);

    const nav = screen.getByText('Containers').closest('nav');
    expect(nav).toHaveClass('hidden', 'md:flex');
  });

  it('has proper responsive classes for status text', () => {
    render(<Header />);

    const statusText = screen.getByText('Online');
    expect(statusText).toHaveClass('hidden', 'sm:inline');
  });

  it('handles missing onLogout prop gracefully', async () => {
    const user = userEvent.setup();

    render(<Header />);

    const logoutButton = screen.getByText('Logout');
    // Should not throw when clicked without onLogout handler
    await user.click(logoutButton);
  });
});