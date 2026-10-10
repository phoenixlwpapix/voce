import type { Metadata } from "next";
import { ExtensionSetup } from "@/components/extension-setup";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Chrome 划词扩展" };

export default function ExtensionPage() {
  return (
    <>
      <SiteHeader />
      <ExtensionSetup />
    </>
  );
}
