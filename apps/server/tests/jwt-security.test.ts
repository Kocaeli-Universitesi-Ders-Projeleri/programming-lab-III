import { expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
it('süresi dolmuş, yanlış audience/issuer ve değiştirilmiş JWT reddedilir', async () => {
  const options = { subject:'111111111111111111111111', jwtid:'222222222222222222222222', audience:'kou-client', issuer:'kou-staj', expiresIn:60 };
  const expired = jwt.sign({},env.JWT_SECRET,{...options,expiresIn:-1});
  const audience = jwt.sign({},env.JWT_SECRET,{...options,audience:'different-client'});
  const issuer = jwt.sign({},env.JWT_SECRET,{...options,issuer:'different-issuer'});
  const parts = jwt.sign({},env.JWT_SECRET,options).split('.'); parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  for (const token of [expired,audience,issuer,parts.join('.')]) expect((await request(app).get('/api/v1/auth/me').set('Cookie','kou_session='+token)).status).toBe(401);
});
it('imza geçerli olsa bile nesne biçimindeki subject claim sorguya ulaşamaz', async () => {
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = encoded({alg:'HS256',typ:'JWT'})+'.'+encoded({sub:{$ne:null},jti:'222222222222222222222222',aud:'kou-client',iss:'kou-staj',exp:Math.floor(Date.now()/1000)+60});
  const token=body+'.'+createHmac('sha256',env.JWT_SECRET).update(body).digest('base64url');
  expect((await request(app).get('/api/v1/auth/me').set('Cookie','kou_session='+token)).status).toBe(401);
});
