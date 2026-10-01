import { expect, test } from "bun:test";
import { Button, Checkbox, Page, Popover } from "./index";

test("Button renders a button by default and a link with as='a'", () => {
  expect(
    String(
      <Button data-variant="tinted" type="submit">
        Save
      </Button>,
    ),
  ).toBe('<button class="v-button" data-variant="tinted" type="submit">Save</button>');
  expect(
    String(
      <Button as="a" href="/clients" class="px-l">
        Clients
      </Button>,
    ),
  ).toBe('<a class="v-button px-l" href="/clients">Clients</a>');
});

test("attributes are checked per element", () => {
  // @ts-expect-error a button has no href
  <Button href="/clients">Clients</Button>;
  // @ts-expect-error a link has no disabled
  <Button as="a" disabled>
    Clients
  </Button>;
  // @ts-expect-error not a Varde variant
  <Button data-variant="ghost">Clients</Button>;
});

test("Page renders the back link and actions only when given", () => {
  const plain = String(<Page title="Clients">Body</Page>);
  expect(plain).toContain('<h1 class="fs-m">Clients</h1>');
  expect(plain).not.toContain("<a");
  expect(plain).not.toContain("ml-auto");

  const full = String(
    <Page
      title="Acme"
      back={{ href: "/clients", label: "Back to clients" }}
      actions={<Button>Edit</Button>}
    >
      Body
    </Page>,
  );
  expect(full).toContain('href="/clients"');
  expect(full).toContain("Back to clients");
  expect(full).toContain('<button class="v-button">Edit</button>');
});
