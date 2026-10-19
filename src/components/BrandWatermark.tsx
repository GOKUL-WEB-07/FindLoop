/** Shared transparent logo mark; decoration only, never an interaction target. */
export function BrandWatermark(){
  const logo=`url("${import.meta.env.BASE_URL}findloop-logo.svg")`;
  return <div className="app-watermark" aria-hidden="true" style={{maskImage:logo,WebkitMaskImage:logo}}/>;
}
