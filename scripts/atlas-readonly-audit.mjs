import mongoose from 'mongoose';
import { config } from 'dotenv';
config({quiet:true});
const report = { ping:'NOT TESTED', tlsConfigured:false, certificateBypass:false, privilegeInspection:'NOT TESTED', broadWritePrivileges:null, atlasNetworkAccess:'NOT TESTED', atlasBackupSettings:'NOT TESTED' };
try {
  await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
  await mongoose.connection.db.command({ping:1}); report.ping='PASS';
  const options = mongoose.connection.getClient().options;
  report.tlsConfigured=options.tls === true; report.certificateBypass=options.tlsInsecure === true || options.tlsAllowInvalidCertificates === true || options.tlsAllowInvalidHostnames === true;
  try { const status = await mongoose.connection.db.command({connectionStatus:1,showPrivileges:true}); const privileges = status.authInfo?.authenticatedUserPrivileges; if (Array.isArray(privileges)) { report.privilegeInspection='PASS'; report.privilegeResourceCount=privileges.length; report.broadWritePrivileges=privileges.some(p => (p.resource?.anyResource || p.resource?.db === '') && p.actions?.some(a => ['anyAction','insert','update','remove','dropDatabase'].includes(a))); } } catch { report.privilegeInspection='NOT TESTED (command unavailable)'; }
} catch (error) { report.ping='FAIL'; report.errorType=error.name; process.exitCode=1; }
finally { await mongoose.disconnect(); }
console.log(JSON.stringify(report,null,2));
