import Script from "next/script";

function GTag() {
  return (
    <div className="container">
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-NDMKGRENDB" />
      <Script id="google-analytics">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
 
          gtag('config', 'G-NDMKGRENDB');
        `}
      </Script>
    </div>
  );
}

export default GTag;
