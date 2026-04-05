import type { Metadata } from "next";
import ToastProvider from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  title: "School Platform",
  description: "School administration system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}