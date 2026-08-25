import type { Metadata } from "next";
import { ExtensionSetup } from "@/components/extension-setup";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Chrome extension" };

export default function ExtensionPage() {
  return (
    <>
      <SiteHeader />
      <ExtensionSetup />
    </>
  );
}
