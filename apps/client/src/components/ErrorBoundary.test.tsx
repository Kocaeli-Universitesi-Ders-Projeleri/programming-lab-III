import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
it('görüntüleme hatasında teknik ayrıntıyı ekrana yazmaz', () => {
  const consoleError = vi.spyOn(console,'error').mockImplementation(() => undefined);
  function Broken(): never { throw new Error('private-diagnostic-sentinel'); }
  try { const { unmount } = render(<ErrorBoundary><Broken/></ErrorBoundary>); expect(screen.getByRole('heading', { name:'Sayfa görüntülenemedi' })).toBeDefined(); expect(screen.queryByText('private-diagnostic-sentinel')).toBeNull(); unmount(); }
  finally { consoleError.mockRestore(); }
});
