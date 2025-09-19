import { Button } from '../Button';

export const ColorDemo = () => {
  return (
    <div className="p-8 space-y-6 bg-white">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Harbourmaster Color Scheme Demo</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-700">Button Variants</h3>
        <div className="flex gap-4 flex-wrap">
          <Button variant="primary">Primary Blue</Button>
          <Button variant="secondary">Secondary Gray</Button>
          <Button variant="success">Success Green</Button>
          <Button variant="error">Error Red</Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-700">Harbor Theme Colors</h3>
        <div className="grid grid-cols-5 gap-2">
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
            <div
              key={shade}
              className={`h-16 rounded-lg bg-harbor-${shade} flex items-center justify-center text-xs font-medium ${
                shade > 500 ? 'text-white' : 'text-neutral-900'
              }`}
            >
              {shade}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-700">Primary Blue Colors</h3>
        <div className="grid grid-cols-5 gap-2">
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
            <div
              key={shade}
              className={`h-16 rounded-lg bg-primary-${shade} flex items-center justify-center text-xs font-medium ${
                shade > 500 ? 'text-white' : 'text-neutral-900'
              }`}
            >
              {shade}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-700">Success Green Colors</h3>
        <div className="grid grid-cols-5 gap-2">
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
            <div
              key={shade}
              className={`h-16 rounded-lg bg-success-${shade} flex items-center justify-center text-xs font-medium ${
                shade > 500 ? 'text-white' : 'text-neutral-900'
              }`}
            >
              {shade}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};