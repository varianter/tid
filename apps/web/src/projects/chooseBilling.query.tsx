import { Page, Section } from "@tid/ui";
import type { Context } from "hono";
import { billingDescriptions, billingLabels, billings } from "./billing";

// The first step of starting a project, since billing decides which fields the project has.
export const chooseBilling = (c: Context) => {
  const client = c.req.query("client");
  const query = client ? `?${new URLSearchParams({ client })}` : "";
  return c.render(
    <Page
      title="New project"
      back={{ href: "/projects", label: "Back to projects" }}
      layer="tooltip"
    >
      <Section title="How is the project billed?">
        <ul class="stack-v gap-s w-max-3">
          {billings.map((billing) => (
            <li>
              <a
                href={`/projects/new/${billing}${query}`}
                class="stack-v gap-3xs b-all bc-subtle br-l p-xs bg-wash:hover"
              >
                <span class="fw-medium">{billingLabels[billing]}</span>
                <span class="fs-s ink-subtle">{billingDescriptions[billing]}</span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </Page>,
  );
};
