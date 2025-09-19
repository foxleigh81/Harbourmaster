import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ContainerCard } from './ContainerCard';

const mockContainer = {
  id: '1234567890abcdef',
  names: ['/nginx-web'],
  image: 'nginx:latest',
  state: 'running' as const,
  status: 'Up 2 hours',
  ports: [
    { host: '0.0.0.0', public: 8080, private: 80 },
    { public: 443, private: 443 },
  ],
};

const mockHandlers = {
  onStart: vi.fn(),
  onStop: vi.fn(),
  onRestart: vi.fn(),
  onDelete: vi.fn(),
};

describe('ContainerCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders container information', () => {
    render(<ContainerCard container={mockContainer} {...mockHandlers} />);

    expect(screen.getByText('nginx-web')).toBeInTheDocument();
    expect(screen.getByText('nginx:latest')).toBeInTheDocument();
    expect(screen.getByText('Up 2 hours')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('displays ports correctly', () => {
    render(<ContainerCard container={mockContainer} {...mockHandlers} />);

    expect(screen.getByText('Ports:')).toBeInTheDocument();
    expect(screen.getByText('0.0.0.0:8080→80')).toBeInTheDocument();
    expect(screen.getByText('?:443→443')).toBeInTheDocument();
  });

  it('shows stop and restart buttons for running container', () => {
    render(<ContainerCard container={mockContainer} {...mockHandlers} />);

    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByText('Restart')).toBeInTheDocument();
    expect(screen.queryByText('Start')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows start and delete buttons for stopped container', () => {
    const stoppedContainer = { ...mockContainer, state: 'exited' as const };
    render(<ContainerCard container={stoppedContainer} {...mockHandlers} />);

    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Stop')).not.toBeInTheDocument();
    expect(screen.queryByText('Restart')).not.toBeInTheDocument();
  });

  it('calls onStop when stop button is clicked', async () => {
    const user = userEvent.setup();
    render(<ContainerCard container={mockContainer} {...mockHandlers} />);

    const stopButton = screen.getByText('Stop');
    await user.click(stopButton);

    expect(mockHandlers.onStop).toHaveBeenCalledWith('1234567890abcdef');
  });

  it('calls onRestart when restart button is clicked', async () => {
    const user = userEvent.setup();
    render(<ContainerCard container={mockContainer} {...mockHandlers} />);

    const restartButton = screen.getByText('Restart');
    await user.click(restartButton);

    expect(mockHandlers.onRestart).toHaveBeenCalledWith('1234567890abcdef');
  });

  it('calls onStart when start button is clicked', async () => {
    const user = userEvent.setup();
    const stoppedContainer = { ...mockContainer, state: 'exited' as const };
    render(<ContainerCard container={stoppedContainer} {...mockHandlers} />);

    const startButton = screen.getByText('Start');
    await user.click(startButton);

    expect(mockHandlers.onStart).toHaveBeenCalledWith('1234567890abcdef');
  });

  it('shows confirmation dialog and calls onDelete when delete is confirmed', async () => {
    const user = userEvent.setup();
    const stoppedContainer = { ...mockContainer, state: 'exited' as const };

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ContainerCard container={stoppedContainer} {...mockHandlers} />);

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Delete container nginx-web?');
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('1234567890abcdef');

    confirmSpy.mockRestore();
  });

  it('does not call onDelete when delete is cancelled', async () => {
    const user = userEvent.setup();
    const stoppedContainer = { ...mockContainer, state: 'exited' as const };

    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ContainerCard container={stoppedContainer} {...mockHandlers} />);

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockHandlers.onDelete).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows update available message', () => {
    const containerWithUpdate = { ...mockContainer, updateAvailable: true };
    render(<ContainerCard container={containerWithUpdate} {...mockHandlers} />);

    expect(screen.getByText('Update available')).toBeInTheDocument();
  });

  it('disables buttons while action is in progress', async () => {
    const user = userEvent.setup();

    // Make onStop return a promise that we can control
    let resolveStop: () => void;
    const stopPromise = new Promise<void>((resolve) => {
      resolveStop = resolve;
    });
    mockHandlers.onStop.mockReturnValue(stopPromise);

    render(<ContainerCard container={mockContainer} {...mockHandlers} />);

    const stopButton = screen.getByText('Stop');
    const restartButton = screen.getByText('Restart');

    // Click stop button
    await user.click(stopButton);

    // Buttons should be disabled
    expect(stopButton).toBeDisabled();
    expect(restartButton).toBeDisabled();

    // Resolve the promise
    resolveStop!();
    await waitFor(() => {
      expect(stopButton).not.toBeDisabled();
      expect(restartButton).not.toBeDisabled();
    });
  });
});