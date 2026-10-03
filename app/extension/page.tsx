import type { Metadata } from "next";
import { ExtensionSetup } from "@/components/extension-setup";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "浏览器插件配置" };

export default function ExtensionPage() {
  return (
    <>
      <SiteHeader />
      <ExtensionSetup />
    </>
  );
}
