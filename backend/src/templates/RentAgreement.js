function generateRentAgreement({
  owner,
  tenant,
  moveInDate,
  rentAmount,
  rentInWords,
  securityDeposit,
  tenancyPeriod,
  witness1,
  witness2,
}) {
  return `
  RENT AGREEMENT

  This Rent Agreement is made and executed on this day of ${moveInDate}, between:

  1. The Owner/Lessor:
     Name: ${owner?.name || '____________________'}
     Address: ${owner?.address || '____________________'}
     Contact No.: ${owner?.contact || '____________________'}

  AND

  2. The Tenant/Lessee:
     Name: ${tenant?.name || '____________________'}
     Address: ${tenant?.address || '____________________'}
     Contact No.: ${tenant?.contact || '____________________'}

  TERMS AND CONDITIONS

  1. The Lessor agrees to let out, and the Lessee agrees to take on rent the premises located at ${
    tenant?.address || '____________________'
  }.

  2. The rent of the said premises shall be ₹${rentAmount} (Rupees ${rentInWords} only) per month, payable on or before the ___ day of each month.

  3. The period of tenancy shall be for ${
    tenancyPeriod || '11 months'
  }, commencing from ${moveInDate} to ___ months later.

  4. The Lessee shall pay a security deposit of ₹${securityDeposit}, which will be refundable at the time of vacating the premises after adjusting dues, if any.

  5. The Lessee shall not sublet, transfer, or assign the premises without prior written consent of the Lessor.

  6. The Lessee shall maintain the premises in good condition and bear all minor repairs during the tenancy.

  7. The electricity, water, and maintenance charges shall be borne by the Lessee as per actual usage.

  8. Either party may terminate this agreement by giving ___ days’ written notice.

  IN WITNESS WHEREOF
  Both parties have signed this Rent Agreement on the date mentioned above.

  Note: (This is a digital agreement; no physical signature is required as it is already digitally signed.)

  Witness 1: ${witness1 || '____________________'}
  Witness 2: ${witness2 || '____________________'}
  `;
}

module.exports = generateRentAgreement;
