import type { Meta, StoryObj } from '@storybook/react';
import { ColorDemo } from './ColorDemo';

const meta: Meta<typeof ColorDemo> = {
  title: 'Examples/ColorDemo',
  component: ColorDemo,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};