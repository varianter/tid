import { ColorMode } from "@tid/ui";

type NoticeOrganization = { id: number; name: string };

// Every manager administers every organization, so this guards against changing another by mistake.
export function OtherOrganizationNotice({
  current,
  own,
  back,
}: {
  current: NoticeOrganization;
  own: NoticeOrganization;
  /** The same page for the manager's own organization. */
  back: string;
}) {
  if (current.id === own.id) return null;
  return (
    <ColorMode palette="yellow" role="status">
      <div class="surface-dyed py-4xs px-xs b-all bc-subtle br-l">
        <p class="stack-h gap-xs justify-center ink-subtle fs-s">
          You are currently in the Administration of {current.name}.
          <a class="v-link" href={back}>
            Back to {own.name}
          </a>
        </p>
      </div>
    </ColorMode>
  );
}
