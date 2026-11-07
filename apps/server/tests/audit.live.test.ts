import { expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { countInternshipDays, todayInTurkey } from '@kou/shared';
import request from './helpers/request.js';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User, StudentProfile, AuditLog, Session } from '../src/models/auth.js';
import { Application, Document, ValidationReport } from '../src/models/application.js';
import { removePrivateFile } from '../src/services/privateStorage.js';
import { validationFixture } from './fixtures/validation.js';
it.skipIf(process.env.LIVE_AUTH_TEST !== '1')('Audit Atlas: mass assignment, IDOR yazma, dosya sınırı, aktiflik, rotation ve kilit yarışı', async () => {
  await mongoose.connect(env.MONGODB_URI,{dbName:'kou_staj_security_audit_tests',serverSelectionTimeoutMS:10000});
  const ids: mongoose.Types.ObjectId[] = [], appIds: mongoose.Types.ObjectId[] = []; const prefix=randomUUID().replaceAll('-','').slice(0,10), password=randomUUID();
  try {
    await Promise.all([User.init(),StudentProfile.init(),Application.init(),Document.init(),ValidationReport.init(),AuditLog.init(),Session.init()]);
    const hash=await bcrypt.hash(password,12), names=['Sentetik Öğrenci','Sentetik İkinci','Sentetik Yönetici'];
    const users=[];
    for(let i=0;i<3;i++){const user=await User.create({username:prefix+i,email:prefix+i+'@example.test',name:names[i],passwordHash:hash,role:i===2?'ROLE_ADMIN':'ROLE_STUDENT'});ids.push(user._id);users.push(user);if(i<2)await StudentProfile.create({user:user._id,studentNumber:'TEST'+prefix+i,department:'Yazılım Mühendisliği',identityNumber:'1000000014'+i,nationality:'TR',healthStatus:4});}
    const login=async(index:number,old?:string)=>{const r=await request(app).post('/api/v1/auth/login').set('Cookie',old??'').send({identifier:users[index].username,password,role:'ROLE_ADMIN',userId:ids[2]});expect(r.status).toBe(200);expect(r.body.user.role).toBe(index===2?'ROLE_ADMIN':'ROLE_STUDENT');return r.headers['set-cookie'][0].split(';')[0];};
    const a=await login(0), b=await login(1), admin=await login(2);
    const students=await request(app).get('/api/v1/admin/students').query({q:prefix}).set('Cookie',admin);expect(students.body.total).toBe(2);for(const row of students.body.items){expect(row.healthStatus).toBeUndefined();expect(row.identityNumber).toBeUndefined();expect(row.address).toBeUndefined();}
    const stats=await request(app).get('/api/v1/admin/dashboard/stats').set('Cookie',admin);expect(stats.body.recentEvents.every((r:{ip?:string})=>r.ip===undefined)).toBe(true);
    const profile=await request(app).get('/api/v1/students/me').set('Cookie',a);expect(profile.body.user.id).toBe(ids[0].toString());
    expect((await request(app).get('/api/v1/students/'+ids[1]).set('Cookie',a)).status).toBe(404);
    expect((await request(app).get('/api/v1/students/me').query({userId:ids[1].toString()}).set('Cookie',a)).status).toBe(400);
    const data=validationFixture().application;data.name=names[0];data.email=users[0].email;data.studentNumber='TEST'+prefix+'0';data.identityNumber='10000000140';data.submissionDate=todayInTurkey();data.startDate='2027-07-01';data.endDate='2027-07-30';data.academicYear='2026-2027';data.declaredDays=countInternshipDays(data.startDate,data.endDate,data.workingDays).days!;
    const png=await sharp({create:{width:5,height:5,channels:3,background:'#fff'}}).png().toBuffer();
    const filename='Türkçe-İğüşöç.png';
    const create=await request(app).post('/api/v1/applications').set('Cookie',a).field('data',JSON.stringify({...data,student:ids[1],status:'COMPLETED',role:'ROLE_ADMIN'})).attach('file',png,{filename,contentType:'image/png'});expect(create.status).toBe(201);const id=create.body.id;appIds.push(new mongoose.Types.ObjectId(id));
    const stored=await Application.findById(id);expect(stored?.student.toString()).toBe(ids[0].toString());expect(stored?.status).toBe('UPLOADED');
    const detail=await request(app).get('/api/v1/applications/'+id).set('Cookie',a);expect(detail.body.document.storageKey).toBeUndefined();expect(detail.body.document.originalName).toBe(filename);const doc=detail.body.document._id;
    for(const path of ['/applications/'+id,'/applications/'+id+'/report','/documents/'+doc+'/download'])expect((await request(app).get('/api/v1'+path).set('Cookie',b)).status).toBe(404);
    expect((await request(app).post('/api/v1/applications/'+id+'/documents').set('Cookie',b).field('data',JSON.stringify(data)).attach('file',png,{filename:'other.png',contentType:'image/png'})).status).toBe(404);
    expect((await request(app).delete('/api/v1/applications/'+id).set('Cookie',b)).status).toBe(404);
    const download=await request(app).get('/api/v1/documents/'+doc+'/download').set('Cookie',admin);expect(download.status).toBe(200);expect(download.body).toEqual(png);expect(download.headers['cache-control']).toBe('no-store');
    expect((await request(app).get('/api/v1/applications/bad-id').set('Cookie',a)).status).toBe(404);
    expect((await request(app).post('/api/v1/applications').set('Cookie',a).field('data',JSON.stringify(data)).attach('file',Buffer.alloc((env.MAX_DOCUMENT_MB+1)*1024*1024),{filename:'oversize.png',contentType:'image/png'})).status).toBe(400);
    expect(await Application.countDocuments({student:ids[0]})).toBe(1);
    // The token's role claim is not authority; the role is fetched from MongoDB.
    const payload=jwt.decode(a.slice('kou_session='.length)) as jwt.JwtPayload;
    const extraRole=jwt.sign({role:'ROLE_ADMIN'},env.JWT_SECRET,{subject:ids[0].toString(),jwtid:payload.jti,audience:'kou-client',issuer:'kou-staj',expiresIn:'5m'});
    expect((await request(app).get('/api/v1/admin/access').set('Cookie','kou_session='+extraRole)).status).toBe(403);
    const renewed=await login(1,b);expect((await request(app).get('/api/v1/auth/me').set('Cookie',b)).status).toBe(401);expect((await request(app).get('/api/v1/auth/me').set('Cookie',renewed)).status).toBe(200);
    await User.updateOne({_id:ids[1]},{$set:{active:false}});expect((await request(app).get('/api/v1/auth/me').set('Cookie',renewed)).status).toBe(401);expect((await request(app).post('/api/v1/auth/login').send({identifier:users[1].username,password})).status).toBe(401);await User.updateOne({_id:ids[1]},{$set:{active:true}});
    // Freeze a correct password comparison after the account snapshot was read.
    let release!:()=>void, signal!:()=>void;const barrier=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{signal=r;});const compare=bcrypt.compare.bind(bcrypt);let armed=true;
    const spy=vi.spyOn(bcrypt,'compare').mockImplementation((async(plain:string,hashed:string)=>{if(armed){armed=false;signal();await barrier;}return compare(plain,hashed);}) as typeof bcrypt.compare);
    try {const pending=request(app).post('/api/v1/auth/login').send({identifier:users[1].username,password}).then(r=>r);await started;await User.updateOne({_id:ids[1]},{$set:{failedAttempts:5,lockedUntil:new Date(Date.now()+60000)}});release();expect((await pending).status).toBe(423);expect((await User.findById(ids[1]))?.failedAttempts).toBe(5);}
    finally{release();spy.mockRestore();}
    // A per-user upload limit applies even when parsing fails; a second user is independent.
    for(let i=0;i<9;i++)expect((await request(app).post('/api/v1/applications').set('Cookie',renewed).send({})).status).toBe(400);
    expect((await request(app).post('/api/v1/applications').set('Cookie',renewed).send({})).status).toBe(429);
    expect((await request(app).post('/api/v1/applications').set('Cookie',a).send({})).status).toBe(400);
  } finally {
    vi.restoreAllMocks();const records=await Application.find({student:{$in:ids}}).select('_id');appIds.push(...records.map(r=>r._id));for(const doc of await Document.find({application:{$in:appIds}}).select('+storageKey'))await removePrivateFile(doc.storageKey);
    await Promise.all([Document.deleteMany({application:{$in:appIds}}),ValidationReport.deleteMany({application:{$in:appIds}}),Application.deleteMany({_id:{$in:appIds}}),StudentProfile.deleteMany({user:{$in:ids}}),Session.deleteMany({user:{$in:ids}}),AuditLog.deleteMany({user:{$in:ids}}),User.deleteMany({_id:{$in:ids}})]);await mongoose.disconnect();
  }
},240000);
