// app/layout.js
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Script
          src="https://www.dwin2.com/pub.2933261.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}