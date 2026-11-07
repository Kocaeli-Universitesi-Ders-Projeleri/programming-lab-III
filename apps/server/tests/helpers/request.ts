import supertest from 'supertest';
// Business regression tests use the actual CSRF handshake. Security tests use raw supertest.
export default function request(app: Parameters<typeof supertest>[0]) {
  const agent = supertest(app);
  return new Proxy(agent, { get(target, key, receiver) {
    if (typeof key !== 'string' || !['post', 'patch', 'put', 'delete'].includes(key)) return Reflect.get(target, key, receiver);
    return (path: string) => {
      const test = (target as unknown as Record<string, (url: string) => supertest.Test>)[key](path);
      const original = test.then.bind(test);
      test.then = ((resolve: (r: supertest.Response) => unknown, reject: (e: unknown) => unknown) => (async () => {
        const cookie = test.get('Cookie');
        const handshakeAgent = supertest(app);
        const handshake = cookie ? await handshakeAgent.get('/api/v1/auth/csrf').set('Cookie', cookie) : await handshakeAgent.get('/api/v1/auth/csrf');
        const csrfCookie = (handshake.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
        test.set('Cookie', [cookie, csrfCookie].filter(Boolean).join('; ')); test.set('X-CSRF-Token', handshake.body.csrfToken);
        return original();
      })().then(resolve, reject)) as typeof test.then;
      return test;
    };
  } });
}
