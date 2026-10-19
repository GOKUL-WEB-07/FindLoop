export function BrandLogo(){
  return <><svg className="brand-mark" viewBox="0 0 88 88" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"><path d="M68 27A31 31 0 1 0 73 49"/><path d="M54 26h15V11"/><path d="M31 59V30h20M31 44h15"/></g></svg><b>FindLoop</b></>;
}

export function BrandSplash(){
  return <div className="startup-splash" role="status"><img src={`${import.meta.env.BASE_URL}findloop-logo.svg`} width="300" height="73" alt="FindLoop"/><span>Loading your campus space…</span></div>;
}
