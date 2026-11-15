import { expect, it } from 'vitest';
import { isValidGoogleFormUrl, googleFormUrlSchema } from '@kou/shared';
import request from './helpers/request.js';
import { app } from '../src/app.js';

it('yalnız https Google Form adreslerini geçerli sayar', () => {
  for (const url of ['https://docs.google.com/forms/d/e/1FAIpQLSf_abcdefghijklmnop/viewform', 'https://docs.google.com/forms/d/1AbCdEfGhIjKlMnOp/edit', 'https://docs.google.com/forms/u/0/d/e/1FAIpQLSfabcdefghij/viewform?usp=sf_link', 'https://forms.gle/AbCd1234XyZ']) {
    expect(isValidGoogleFormUrl(url), url).toBe(true);
  }
  for (const url of ['', 'docs.google.com/forms/d/e/abc/viewform', 'http://docs.google.com/forms/d/e/1FAIpQLSfabcdefghij/viewform', 'https://docs.google.com.evil.test/forms/d/e/1FAIpQLSfabcdefghij/viewform', 'https://evil.test/?u=https://docs.google.com/forms/d/x', 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit', 'https://user:pw@docs.google.com/forms/d/1AbCdEfGhIjKlMnOp/edit', 'javascript:alert(1)', 'https://forms.gle/']) {
    expect(isValidGoogleFormUrl(url), url).toBe(false);
  }
  expect(googleFormUrlSchema.safeParse({ url: 'https://forms.gle/AbCd1234XyZ', extra: 1 }).success).toBe(false);
});

it('Google Form adresi endpointi oturum ister', async () => {
  expect((await request(app).put('/api/v1/students/me/google-form').send({ url: 'https://forms.gle/AbCd1234XyZ' })).status).toBe(401);
});
