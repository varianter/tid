import { expect, test } from "bun:test";
import { Button, DataGrid, FormField, Page, Tabs } from "./index";

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

test("FormField links its errors to the input, and shows nothing without errors", () => {
  const invalid = String(<FormField name="name" label="Name" errors={["Enter a name"]} />);
  expect(invalid).toContain('aria-invalid="true" aria-describedby="name-error"');
  expect(invalid).toContain('id="name-error"');
  expect(invalid).toContain("Enter a name");

  const valid = String(<FormField name="name" label="Name" errors={[]} />);
  expect(valid).not.toContain("aria-");
  expect(valid).not.toContain("color-mode");
});

test("Tabs.Link marks only the active tab as the current page", () => {
  const html = String(
    <Tabs aria-label="Group by">
      <Tabs.Link href="/a" active>
        A
      </Tabs.Link>
      <Tabs.Link href="/b" active={false}>
        B
      </Tabs.Link>
    </Tabs>,
  );
  expect(html).toContain('aria-label="Group by"');
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
});

test("DataGrid aligns cells by column and drops hidden columns with their cells", () => {
  const showMissing = false;
  const grid = String(
    <DataGrid
      columns={[
        { label: "Name" },
        { label: "Hours", kind: "number" },
        showMissing && { label: "Missing", kind: "number" },
      ]}
    >
      <DataGrid.Row href="/users/1">
        Ada
        {"7,5 h"}
        {showMissing && "0 h"}
      </DataGrid.Row>
    </DataGrid>,
  );
  expect(grid).toContain("grid-template-columns: minmax(16ch, 1fr) max-content;");
  expect(grid).toContain('<span class="ta-right">Hours</span>');
  expect(grid).not.toContain("Missing");
  expect(grid).toContain('<span>Ada</span><span class="ta-right">7,5 h</span></a>');
});

test("DataGrid rejects a row whose cells don't match its columns", () => {
  expect(() =>
    String(
      <DataGrid columns={[{ label: "Name" }, { label: "Hours", kind: "number" }]}>
        <DataGrid.Row>Ada</DataGrid.Row>
      </DataGrid>,
    ),
  ).toThrow("1 cells for 2 columns");
});
