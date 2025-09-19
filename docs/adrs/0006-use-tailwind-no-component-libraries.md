# ADR 006: Use Tailwind CSS without component libraries

- **Date created**: 19/01/2025
- **Date last updated**: 19/01/2025
- **Driver**: Harbourmaster Development Team

## Status

![accepted]

## Context

For the Harbourmaster UI styling, we need to choose a CSS approach that balances:
- Developer productivity
- Bundle size
- Performance
- Accessibility
- Maintainability
- Customization flexibility

Options considered:
1. **Plain CSS/CSS Modules** - Full control but slow development
2. **Tailwind CSS alone** - Utility-first, small bundle with PurgeCSS
3. **Tailwind + Component Library** (shadcn/ui, Headless UI) - Faster but more dependencies
4. **Material-UI/Ant Design** - Full framework, large bundle
5. **Styled Components/Emotion** - CSS-in-JS, runtime overhead

## Decision

Use **Tailwind CSS without any component libraries**. Build all components from scratch using Tailwind utilities.

## Consequences

### Positive Consequences

- **Minimal bundle size** - Only CSS actually used is included (~10-20KB gzipped)
- **No JavaScript overhead** - Pure CSS utilities, no runtime styling
- **Full control** - Every aspect of styling is customizable
- **Consistent design** - Enforced design tokens via Tailwind config
- **Better performance** - No CSS-in-JS runtime, no component library overhead
- **Learning opportunity** - Team gains deep understanding of components
- **No version conflicts** - No dependency on component library updates
- **Accessibility control** - Can ensure ARIA attributes are correct
- **Tailwind ecosystem** - Access to plugins, Tailwind UI patterns (for reference)

### Negative Consequences

- **Slower initial development** - Must build every component from scratch
- **Reinventing wheels** - Creating solved problems (modals, dropdowns, etc.)
- **Accessibility burden** - Must implement all ARIA patterns ourselves
- **No component documentation** - Must document our own components
- **Inconsistency risk** - Without library, might create inconsistent patterns
- **Maintenance burden** - All component bugs are ours to fix

### Mitigation Strategies

- Create reusable component patterns early
- Use Tailwind UI (paid) examples as reference (not dependency)
- Implement comprehensive accessibility testing
- Document component patterns in Storybook (Phase 2)
- Use React Aria or Radix Primitives for complex interactions (Phase 2 if needed)
- Establish component conventions in team guidelines

## Technical Implementation

### Tailwind Configuration

```javascript
// apps/ui/tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette for Harbourmaster
        harbor: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
```

### Component Example - Button

```tsx
// apps/ui/src/components/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm rounded',
      md: 'px-4 py-2 text-base rounded-md',
      lg: 'px-6 py-3 text-lg rounded-lg'
    };

    return (
      <button
        ref={ref}
        className={clsx(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
```

### Accessibility Pattern Example

```tsx
// apps/ui/src/components/Modal.tsx
export function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      // Trap focus in modal
      const previousActive = document.activeElement;
      return () => {
        (previousActive as HTMLElement)?.focus();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 id="modal-title" className="text-lg font-semibold mb-4">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </div>
  );
}
```

## Bundle Size Comparison

| Approach | CSS Size | JS Size | Total (gzipped) |
|----------|----------|---------|-----------------|
| Tailwind alone | 15KB | 0KB | 15KB |
| Tailwind + shadcn/ui | 20KB | 45KB | 65KB |
| Material-UI | 80KB | 150KB | 230KB |
| Ant Design | 60KB | 380KB | 440KB |
| Bootstrap | 25KB | 40KB | 65KB |

## Development Velocity Trade-off

| Task | With Component Library | Tailwind Only | Difference |
|------|------------------------|---------------|------------|
| Button | 5 minutes | 30 minutes | +25 min |
| Modal | 10 minutes | 2 hours | +110 min |
| Data Table | 30 minutes | 4 hours | +210 min |
| Form Controls | 20 minutes | 3 hours | +160 min |
| **Total Phase 1** | ~2 days | ~5 days | +3 days |

While development is slower, the benefits of smaller bundle size, better performance, and full control justify the additional time investment for a Docker management tool where performance and reliability are critical.

## Future Considerations

If development velocity becomes a bottleneck in Phase 2+, we can:
1. Adopt Radix Primitives for complex components (headless, accessible)
2. Purchase Tailwind UI license for reference implementations
3. Build our own component library package
4. Selectively adopt shadcn/ui components (copy, not install)

## References

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Bundle Size](https://tailwindcss.com/docs/optimizing-for-production)
- [Web.dev CSS Performance](https://web.dev/css-performance/)
- [Comparing CSS-in-JS Performance](https://pustelto.com/blog/css-vs-css-in-js-perf/)

[proposed]: https://img.shields.io/badge/Proposed-yellow?style=for-the-badge
[accepted]: https://img.shields.io/badge/Accepted-green?style=for-the-badge
[superceded]: https://img.shields.io/badge/Superceded-orange?style=for-the-badge
[rejected]: https://img.shields.io/badge/Rejected-red?style=for-the-badge
[deprecated]: https://img.shields.io/badge/Deprecated-grey?style=for-the-badge