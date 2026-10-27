import { Button, ColorMode, Icon, Popover } from "@tid/ui";
import type { OrganizationOption } from "../organizations/organization";
import { administrationPath } from "./administration.url";

type OrganizationSwitchProps = {
  organizations: OrganizationOption[];
  current: { slug: string; name: string };
};

export function OrganizationSwitcher({ organizations, current }: OrganizationSwitchProps) {
  return (
    <>
      <Button
        type="button"
        popovertarget="organization-switch"
        data-variant="plain"
        data-size="small"
      >
        <Icon name="domain" />
        {current.name}
      </Button>
      <Popover id="organization-switch" data-type="tooltip" data-side="bottom">
        <nav
          aria-label="Organizations"
          class="stack-v gap-4xs b-all bc-subtle p-2xs surface-base br-m shadow-mid"
        >
          {organizations.map((organization) => {
            const active = organization.slug === current.slug;
            return (
              <a
                href={administrationPath(organization.slug)}
                aria-current={active ? "page" : undefined}
                class={`fs-s px-xs py-2xs br-m ${active ? "surface-tinted ink-prominent" : "ink-subtle bg-wash:hover"}`}
              >
                {organization.name}
              </a>
            );
          })}
        </nav>
      </Popover>
    </>
  );
}

// Every manager administers every organization, so this guards against changing another by mistake.
export function OtherOrganizationNotice({
  organizations,
  current,
  ownOrgId,
}: OrganizationSwitchProps & { ownOrgId: number }) {
  const ownOrganization = organizations.find((organization) => organization.id === ownOrgId);
  if (!ownOrganization || ownOrganization.slug === current.slug) return null;
  return (
    <ColorMode palette="yellow" role="status">
      <div class="surface-dyed py-4xs px-xs b-all bc-subtle br-l">
        <p class="stack-h gap-xs justify-center ink-subtle fs-s">
          You are currently in the Administration of {current.name}.
          <a class="v-link" href={administrationPath(ownOrganization.slug)}>
            Back to {ownOrganization.name}
          </a>
        </p>
      </div>
    </ColorMode>
  );
}
