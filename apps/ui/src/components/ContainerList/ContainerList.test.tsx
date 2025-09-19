import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ContainerList } from './ContainerList';

const mockContainers = [
  {
    id: '1234567890abcdef',
    names: ['/nginx-web'],
    image: 'nginx:latest',
    state: 'running' as const,
    status: 'Up 2 hours',
    ports: [
      { host: '0.0.0.0', public: 8080, private: 80 },
    ],
  },
  {
    id: 'abcdef1234567890',
    names: ['/postgres-db'],
    image: 'postgres:13',
    state: 'exited' as const,
    status: 'Exited (0) 5 minutes ago',
    ports: [],
  },
];

const mockHandlers = {
  onStart: vi.fn(),
  onStop: vi.fn(),
  onRestart: vi.fn(),
  onDelete: vi.fn(),
};

describe('ContainerList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders list of containers', () => {
    render(<ContainerList containers={mockContainers} {...mockHandlers} />);

    expect(screen.getByText('nginx-web')).toBeInTheDocument();
    expect(screen.getByText('postgres-db')).toBeInTheDocument();
    expect(screen.getByText('nginx:latest')).toBeInTheDocument();
    expect(screen.getByText('postgres:13')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ContainerList containers={[]} loading={true} {...mockHandlers} />);

    // Should show skeleton loading cards
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no containers', () => {
    render(<ContainerList containers={[]} loading={false} {...mockHandlers} />);

    expect(screen.getByText('No containers')).toBeInTheDocument();
    expect(screen.getByText(/No containers are currently available/)).toBeInTheDocument();
  });

  it('renders containers in grid layout', () => {
    const { container } = render(<ContainerList containers={mockContainers} {...mockHandlers} />);

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('gap-4', 'sm:grid-cols-1', 'lg:grid-cols-2', 'xl:grid-cols-3');
  });

  it('passes correct props to ContainerCard components', () => {
    render(<ContainerList containers={mockContainers} {...mockHandlers} />);

    // Check that all container names are rendered (indicating ContainerCards are rendered)
    expect(screen.getByText('nginx-web')).toBeInTheDocument();
    expect(screen.getByText('postgres-db')).toBeInTheDocument();

    // Check that different states are displayed
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('handles container actions through ContainerCard', async () => {
    const user = userEvent.setup();
    render(<ContainerList containers={mockContainers} {...mockHandlers} />);

    // Find and click a Stop button (should be on the running container)
    const stopButton = screen.getByText('Stop');
    await user.click(stopButton);

    expect(mockHandlers.onStop).toHaveBeenCalledWith('1234567890abcdef');
  });

  it('handles start action for stopped container', async () => {
    const user = userEvent.setup();
    render(<ContainerList containers={mockContainers} {...mockHandlers} />);

    // Find and click a Start button (should be on the exited container)
    const startButton = screen.getByText('Start');
    await user.click(startButton);

    expect(mockHandlers.onStart).toHaveBeenCalledWith('abcdef1234567890');
  });

  it('renders correct number of containers', () => {
    render(<ContainerList containers={mockContainers} {...mockHandlers} />);

    // Should render 2 container cards
    const containerCards = screen.getAllByText(/nginx|postgres/);
    expect(containerCards).toHaveLength(2);
  });

  it('shows empty state instead of loading when loading is false', () => {
    render(<ContainerList containers={[]} loading={false} {...mockHandlers} />);

    expect(screen.getByText('No containers')).toBeInTheDocument();
    expect(screen.queryByText(/animate-pulse/)).not.toBeInTheDocument();
  });

  it('renders single container correctly', () => {
    const singleContainer = [mockContainers[0]];
    render(<ContainerList containers={singleContainer} {...mockHandlers} />);

    expect(screen.getByText('nginx-web')).toBeInTheDocument();
    expect(screen.queryByText('postgres-db')).not.toBeInTheDocument();
  });
});