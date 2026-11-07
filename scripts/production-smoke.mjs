import { spawnSync } from 'node:child_process';
const source = `
import request from 'supertest';
const {app}=await import('./apps/server/dist/app.js');
const https=path=>request(app).get(path).set('X-Forwarded-Proto','https');
const redirect=await request(app).get('/login').set('Host','untrusted.example');
const page=await https('/login');
const csrf=await https('/api/v1/auth/csrf');
const notFound=await https('/api/v1/missing');
const font=await https('/fonts/noto-sans-latin-ext-wght-normal.woff2');
const license=await https('/fonts/Noto-Sans-LICENSE.txt');
const result={redirect:redirect.status===308&&redirect.headers.location==='https://audit.example.test/login',html:page.status===200&&page.text.includes('id="root"'),csp:Boolean(page.headers['content-security-policy']?.includes("script-src 'self'")),secureCookie:csrf.headers['set-cookie']?.every(c=>c.includes('Secure')&&c.includes('HttpOnly')&&c.includes('SameSite=Strict')),api404:notFound.status===404&&notFound.body.message==='Endpoint bulunamadı.',hstsDefaultOff:!page.headers['strict-transport-security'],localFont:font.status===200&&Number(font.headers['content-length'])>1000,fontLicense:license.status===200&&license.text.includes('OPEN FONT LICENSE')};
console.log('PRODUCTION_SMOKE '+JSON.stringify(result));
if(Object.values(result).some(v=>v!==true))process.exitCode=1;
`;
const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',env:{...process.env,NODE_ENV:'production',CLIENT_ORIGIN:'https://audit.example.test',TRUSTED_PROXY_CIDRS:'127.0.0.1/32,::1/128',HSTS_MAX_AGE:'0'}});
process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode=result.status??1;
