const isPHPRealtime = (s) => /\+00:00$/.test(s) && !/\.\d+/.test(s);
console.log(isPHPRealtime('2026-05-09T13:50:05+00:00'));
console.log(isPHPRealtime('2026-05-09T06:50:14.637044+00:00'));
console.log(isPHPRealtime('2026-05-09T06:50:14.000000+00:00'));
