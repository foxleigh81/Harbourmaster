import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Header } from './Header';

const meta: Meta<typeof Header> = {
  title: 'Components/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    onLogout: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    showLogout: true,
  },
};

export const WithoutLogout: Story = {
  args: {
    showLogout: false,
  },
};

export const Interactive: Story = {
  args: {
    showLogout: true,
  },
  render: (args) => (
    <div>
      <Header {...args} />
      <div className="p-8 bg-neutral-50 min-h-screen">
        <h2 className="text-lg font-semibold text-neutral-900">Page Content</h2>
        <p className="mt-2 text-neutral-600">
          This shows how the header looks with page content below it.
        </p>
      </div>
    </div>
  ),
};