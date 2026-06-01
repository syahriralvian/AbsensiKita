import tls from 'tls';

const socket = tls.connect(443, 'n8n.absensikita.id', {
  servername: 'n8n.absensikita.id',
  rejectUnauthorized: false
}, () => {
  const cert = socket.getPeerCertificate();
  console.log("Subject:", cert.subject);
  console.log("Issuer:", cert.issuer);
  console.log("Valid From:", cert.valid_from);
  console.log("Valid To:", cert.valid_to);
  console.log("Subject Alternative Names:", cert.subjectaltname);
  socket.end();
});

socket.on('error', (err) => {
  console.error("Error:", err);
});
