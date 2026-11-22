import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Script from "next/script";
import { ProThemeSync } from "@/components/pro-theme-sync";
import { currentUserIsPro } from "@/lib/pro-theme";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "V9 Tools",
  description: "Đăng bài công khai hàng loạt lên nhiều Page Facebook.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pro = await currentUserIsPro();
  return (
    <html
      lang="vi"
      className={`bg-paper${pro ? " pro-neon" : ""}`}
      data-pro={pro ? "true" : undefined}
      suppressHydrationWarning
    >
      <body className={`${sans.className} min-h-screen antialiased`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`}
        </Script>
        <ProThemeSync />
        {children}
      </body>
    </html>
  );
}
