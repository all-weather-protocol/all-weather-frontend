import Script from "next/script";

function ThirdPartyPlugin() {
  return (
    <div className="container">
      {/* Google Tag Manager */}
      <Script id="google-tag-manager">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-5X4RZWBX');
        `}
      </Script>
      {/* End Google Tag Manager */}

      {/* Google Tag Manager (noscript) */}
      <div
        dangerouslySetInnerHTML={{
          __html: `
            <noscript>
              <iframe
                src="https://www.googletagmanager.com/ns.html?id=GTM-5X4RZWBX"
                height="0"
                width="0"
                style="display:none;visibility:hidden"
              ></iframe>
            </noscript>
          `,
        }}
      />
      {/* End Google Tag Manager (noscript) */}
    </div>
  );
}

export default ThirdPartyPlugin;
