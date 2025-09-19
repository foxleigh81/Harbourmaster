import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { LoginForm } from './LoginForm';

const meta: Meta<typeof LoginForm> = {
  title: 'Components/LoginForm',
  component: LoginForm,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    onSubmit: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const WithError: Story = {
  args: {
    loading: false,
    error: 'Invalid password. Please try again.',
  },
};

export const WithNetworkError: Story = {
  args: {
    loading: false,
    error: 'Network error. Please check your connection and try again.',
  },
};

export const Interactive: Story = {
  args: {
    loading: false,
  },
  render: (args) => {
    const handleSubmit = async (password: string) => {
      console.log('Submitted password:', password);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    };

    return <LoginForm {...args} onSubmit={handleSubmit} />;
  },
};