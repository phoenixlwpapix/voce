import type { Metadata } from "next";
import { InvitationManager } from "@/components/invitation-manager";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Invitations" };

export default function InvitationsPage() {
  return <><SiteHeader /><InvitationManager /></>;
}
