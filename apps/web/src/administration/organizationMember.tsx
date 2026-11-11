import { formatDate } from "@tid/calendar/dateDisplay";
import { DataGrid } from "@tid/ui";
import type { Child } from "hono/jsx";

export type OrganizationMember = {
  id: number;
  name: string;
  email: string;
  lastDay: string | null;
};

/** A member's row title: their name, or what's given instead, over their email and leaving date. */
export function OrganizationMemberTitle({
  member,
  children,
}: {
  member: OrganizationMember;
  children?: Child;
}) {
  return (
    <DataGrid.Title
      secondary={[member.email, member.lastDay && `Left Variant ${formatDate(member.lastDay)}`]
        .filter(Boolean)
        .join(" · ")}
    >
      {children ?? member.name}
    </DataGrid.Title>
  );
}
