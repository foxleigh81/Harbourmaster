import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form', () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Welcome to Harbourmaster')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders the logo and description', () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Enter your password to access the container management dashboard')).toBeInTheDocument();
    expect(screen.getByText('Harbourmaster OS - Docker Container Management')).toBeInTheDocument();
  });

  it('submits form with password', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<LoginForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    const submitButton = screen.getByText('Sign in');

    await user.type(passwordInput, 'mypassword');
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('mypassword');
  });

  it('shows validation error for empty password', async () => {
    const user = userEvent.setup();

    render(<LoginForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByText('Sign in');
    await user.click(submitButton);

    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error for whitespace-only password', async () => {
    const user = userEvent.setup();

    render(<LoginForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    const submitButton = screen.getByText('Sign in');

    await user.type(passwordInput, '   ');
    await user.click(submitButton);

    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('displays server error message', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error="Invalid credentials" />);

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<LoginForm onSubmit={mockOnSubmit} loading={true} />);

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password')).toBeDisabled();

    // Check for loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('disables submit button when loading', () => {
    render(<LoginForm onSubmit={mockOnSubmit} loading={true} />);

    const submitButton = screen.getByText('Signing in...');
    expect(submitButton).toBeDisabled();
  });

  it('disables submit button when password is empty', () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByText('Sign in');
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when password is entered', async () => {
    const user = userEvent.setup();

    render(<LoginForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    const submitButton = screen.getByText('Sign in');

    expect(submitButton).toBeDisabled();

    await user.type(passwordInput, 'password');

    expect(submitButton).not.toBeDisabled();
  });

  it('clears validation error when typing', async () => {
    const user = userEvent.setup();

    render(<LoginForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByText('Sign in');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('Enter password');
    await user.type(passwordInput, 'p');

    await waitFor(() => {
      expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
    });
  });

  it('handles form submission with Enter key', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<LoginForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');

    await user.type(passwordInput, 'mypassword');
    await user.keyboard('{Enter}');

    expect(mockOnSubmit).toHaveBeenCalledWith('mypassword');
  });

  it('applies error styles to input when there is an error', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error="Invalid password" />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    expect(passwordInput).toHaveClass('border-error-300');
  });

  it('applies normal styles to input when there is no error', () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    expect(passwordInput).toHaveClass('border-neutral-300');
    expect(passwordInput).not.toHaveClass('border-error-300');
  });

  it('handles async submission errors gracefully', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error('Network error'));

    render(<LoginForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    const submitButton = screen.getByText('Sign in');

    await user.type(passwordInput, 'password');
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('password');
    // Form should handle the error gracefully without throwing
  });

  it('has proper accessibility attributes', () => {
    render(<LoginForm onSubmit={mockOnSubmit} error="Test error" />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');

    const errorMessage = screen.getByText('Test error');
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });
});