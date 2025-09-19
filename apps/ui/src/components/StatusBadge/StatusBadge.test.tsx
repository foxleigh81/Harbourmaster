import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders running status correctly', () => {
    render(<StatusBadge status="running" />);
    const badge = screen.getByText('Running');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-success-100', 'text-success-800');
  });

  it('renders stopped status correctly', () => {
    render(<StatusBadge status="stopped" />);
    const badge = screen.getByText('Stopped');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-neutral-100', 'text-neutral-800');
  });

  it('renders error status correctly', () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByText('Error');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-error-100', 'text-error-800');
  });

  it('renders starting status correctly', () => {
    render(<StatusBadge status="starting" />);
    const badge = screen.getByText('Starting');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-primary-100', 'text-primary-800');
  });

  it('renders stopping status correctly', () => {
    render(<StatusBadge status="stopping" />);
    const badge = screen.getByText('Stopping');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-neutral-100', 'text-neutral-800');
  });

  it('renders custom text when children are provided', () => {
    render(<StatusBadge status="running">Healthy</StatusBadge>);
    const badge = screen.getByText('Healthy');
    expect(badge).toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StatusBadge status="running" className="custom-class" />);
    const badge = screen.getByText('Running');
    expect(badge).toHaveClass('custom-class');
  });

  it('includes status dot', () => {
    const { container } = render(<StatusBadge status="running" />);
    const dot = container.querySelector('.bg-success-400');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('w-2', 'h-2', 'rounded-full');
  });
});