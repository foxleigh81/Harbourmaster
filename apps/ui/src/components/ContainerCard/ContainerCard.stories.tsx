import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ContainerCard } from './ContainerCard';

const meta: Meta<typeof ContainerCard> = {
  title: 'Components/ContainerCard',
  component: ContainerCard,
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

const baseContainer = {
  id: '1234567890abcdef',
  names: ['/nginx-web'],
  image: 'nginx:latest',
  status: 'Up 2 hours',
  ports: [
    { host: '0.0.0.0', public: 8080, private: 80 },
    { public: 443, private: 443 },
  ],
};

export const Running: Story = {
  args: {
    container: {
      ...baseContainer,
      state: 'running',
    },
  },
};

export const Stopped: Story = {
  args: {
    container: {
      ...baseContainer,
      state: 'exited',
      status: 'Exited (0) 5 minutes ago',
    },
  },
};

export const Error: Story = {
  args: {
    container: {
      ...baseContainer,
      state: 'dead',
      status: 'Dead (1) 10 minutes ago',
    },
  },
};

export const Restarting: Story = {
  args: {
    container: {
      ...baseContainer,
      state: 'restarting',
      status: 'Restarting (1) Less than a second ago',
    },
  },
};

export const WithUpdate: Story = {
  args: {
    container: {
      ...baseContainer,
      state: 'running',
      updateAvailable: true,
    },
  },
};

export const NoPorts: Story = {
  args: {
    container: {
      ...baseContainer,
      state: 'running',
      ports: [],
    },
  },
};

export const LongName: Story = {
  args: {
    container: {
      ...baseContainer,
      names: ['/very-long-container-name-that-should-truncate'],
      image: 'registry.example.com/organization/very-long-image-name:latest',
      state: 'running',
    },
  },
};