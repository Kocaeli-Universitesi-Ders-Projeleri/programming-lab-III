import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CookiePreferences, SiteFooter, preferenceKey } from './Privacy';
beforeEach(() => { localStorage.clear(); Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable:true, writable:true, value: function(this: HTMLDialogElement) { this.setAttribute('open',''); } }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('ilk ziyarette üç seçenek sunar; zorunlularla devam tercihini saklar', async () => {
  render(<MemoryRouter initialEntries={['/login']}><CookiePreferences><div>Uygulama</div><SiteFooter/></CookiePreferences></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Tümünü Kabul Et' })).toBeDefined();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Zorunlu Olanlarla Devam Et' }));
  expect(screen.queryByRole('region', { name: 'Çerez tercihleri' })).toBeNull(); expect(JSON.parse(localStorage.getItem(preferenceKey)!).mode).toBe('essential');
  expect(document.querySelector('script[src]')).toBeNull();
});
it('footer tercihi yeniden açar ve sahte isteğe bağlı kategori göstermez', async () => {
  localStorage.setItem(preferenceKey, JSON.stringify({ version: 1, mode:'all', expiresAt: Date.now()+10000 }));
  render(<MemoryRouter><CookiePreferences><SiteFooter/></CookiePreferences></MemoryRouter>);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Çerez tercihleri' }));
  expect(screen.getByRole('dialog', { name: 'Çerez tercihlerini yönet' })).toBeDefined(); const boxes = screen.getAllByRole('checkbox'); expect(boxes).toHaveLength(1); expect((boxes[0] as HTMLInputElement).disabled).toBe(true);
});
