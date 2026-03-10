import type { Metadata } from "next";

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
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}