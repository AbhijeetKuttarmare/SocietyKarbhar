const axios = require('axios');
(async ()=>{
  try{
  const base = 'http://localhost:4001/api';
    // Request OTP for seeded admin 9888888888
  let r = await axios.post(base + '/auth/otp/request', { phone: '9888888888' });
    console.log('request-otp response:', r.data);
    const otp = r.data.otp || (r.data && r.data.message && r.data.message.match(/OTP:\s*(\d+)/) && r.data.message.match(/OTP:\s*(\d+)/)[1]);
    if(!otp){
      console.error('OTP not returned in dev. Aborting');
      return;
    }
    console.log('Using OTP:', otp);
  r = await axios.post(base + '/auth/otp/verify', { phone: '9888888888', code: otp });
    console.log('verify-otp response:', r.data);
    const token = r.data.token;
    if(!token){
      console.error('No token received');
      return;
    }
    console.log('Token length:', token.length);
    // Call helplines (should be empty list initially)
  r = await axios.get(base + '/admin/helplines', { headers: { Authorization: 'Bearer ' + token } });
  console.log('helplines before:', r.data);
  // create a helpline
  r = await axios.post(base + '/admin/helplines', { type: 'ambulance', name: 'Nearby Ambulance', phone: '1122334455', notes: '24x7' }, { headers: { Authorization: 'Bearer ' + token } });
  console.log('created helpline:', r.data);
  r = await axios.get(base + '/admin/helplines', { headers: { Authorization: 'Bearer ' + token } });
  console.log('helplines after:', r.data);
  // Call summary
  r = await axios.get(base + '/admin/summary', { headers: { Authorization: 'Bearer ' + token } });
  console.log('summary:', r.data);
  }catch(e){
    console.error('ERROR MESSAGE:', e.message);
    if(e.response){
      console.error('RESPONSE STATUS:', e.response.status);
      console.error('RESPONSE DATA:', e.response.data);
    }
    console.error(e.stack);
  }
})();
