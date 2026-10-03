import type { Metadata } from "next";
import { InvitationManager } from "@/components/invitation-manager";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "邀请管理" };

export default function InvitationsPage() {
  return <><SiteHeader /><InvitationManager /></>;
}
