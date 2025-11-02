const gen = require('../src/templates/RentAgreement');
const out = gen({
  owner:{name:'Owner A', address:'Owner Address', contact:'999'},
  tenant:{name:'Tenant B', address:'Tenant Address', contact:'888'},
  moveInDate:'02 Nov 2025', rentAmount:'12000', rentInWords:'Twelve Thousand', securityDeposit:'24000', tenancyPeriod:'11 months', witness1:'W1', witness2:'W2'
});
console.log(out.slice(0,400));
