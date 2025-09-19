import type { Meta, StoryObj } from '@storybook/react';
import { StatusBadge } from './StatusBadge';

const meta: Meta<typeof StatusBadge> = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: { type: 'select' },
      options: ['running', 'stopped', 'error', 'starting', 'stopping'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {
  args: {
    status: 'running',
  },
};

export const Stopped: Story = {
  args: {
    status: 'stopped',
  },
};

export const Error: Story = {
  args: {
    status: 'error',
  },
};

export const Starting: Story = {
  args: {
    status: 'starting',
  },
};

export const Stopping: Story = {
  args: {
    status: 'stopping',
  },
};

export const CustomText: Story = {
  args: {
    status: 'running',
    children: 'Healthy',
  },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="running" />
      <StatusBadge status="stopped" />
      <StatusBadge status="error" />
      <StatusBadge status="starting" />
      <StatusBadge status="stopping" />
    </div>
  ),
};