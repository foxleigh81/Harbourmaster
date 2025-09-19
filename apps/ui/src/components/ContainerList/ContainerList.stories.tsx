import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ContainerList } from './ContainerList';

const meta: Meta<typeof ContainerList> = {
  title: 'Components/ContainerList',
  component: ContainerList,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    onStart: fn(),
    onStop: fn(),
    onRestart: fn(),
    onDelete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockContainers = [
  {
    id: '1234567890abcdef',
    names: ['/nginx-web'],
    image: 'nginx:latest',
    state: 'running' as const,
    status: 'Up 2 hours',
    ports: [
      { host: '0.0.0.0', public: 8080, private: 80 },
      { public: 443, private: 443 },
    ],
  },
  {
    id: 'abcdef1234567890',
    names: ['/postgres-db'],
    image: 'postgres:13',
    state: 'running' as const,
    status: 'Up 1 day',
    ports: [{ public: 5432, private: 5432 }],
  },
  {
    id: 'fedcba0987654321',
    names: ['/redis-cache'],
    image: 'redis:alpine',
    state: 'exited' as const,
    status: 'Exited (0) 5 minutes ago',
    ports: [],
  },
  {
    id: '111222333444555',
    names: ['/api-server'],
    image: 'node:16-alpine',
    state: 'dead' as const,
    status: 'Dead (1) 10 minutes ago',
    ports: [{ public: 3000, private: 3000 }],
  },
  {
    id: '666777888999000',
    names: ['/monitoring'],
    image: 'grafana/grafana:latest',
    state: 'restarting' as const,
    status: 'Restarting (1) Less than a second ago',
    ports: [{ public: 3001, private: 3000 }],
    updateAvailable: true,
  },
];

export const WithContainers: Story = {
  args: {
    containers: mockContainers,
  },
};

export const Loading: Story = {
  args: {
    containers: [],
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    containers: [],
    loading: false,
  },
};

export const SingleContainer: Story = {
  args: {
    containers: [mockContainers[0]],
  },
};

export const ManyContainers: Story = {
  args: {
    containers: [
      ...mockContainers,
      ...mockContainers.map((container, index) => ({
        ...container,
        id: `${container.id}-${index}`,
        names: [`${container.names[0]}-${index}`],
      })),
      ...mockContainers.map((container, index) => ({
        ...container,
        id: `${container.id}-extra-${index}`,
        names: [`${container.names[0]}-extra-${index}`],
      })),
    ],
  },
};