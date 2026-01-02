export function isSmsTestNumber(fromE164: string, tenantOwnerE164: string | null): boolean {
  if (tenantOwnerE164 && fromE164 === tenantOwnerE164) {
    return true;
  }
  
  const allowlist = process.env.SMS_TEST_ALLOWLIST || "";
  if (allowlist) {
    const allowedNumbers = allowlist.split(",").map(n => n.trim());
    return allowedNumbers.includes(fromE164);
  }
  
  return false;
}
