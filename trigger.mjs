fetch('https://absensikita.id/cpanel-webhook.php?secret=Hajimekojo12345').then(r=>r.text()).then(t=>console.log('WEBHOOK:', t)).catch(console.error);
