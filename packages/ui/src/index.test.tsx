import { expect, test } from "bun:test";
import {
  BarChart,
  Button,
  DataGrid,
  FormField,
  Icon,
  ListSummary,
  SummaryList,
  Tabs,
} from "./index";

test("Button renders a button by default and a link with as='a'", () => {
  const button = String(
    <Button data-variant="tinted" type="submit">
      Save
    </Button>,
  );
  expect(button).toMatch(/^<button[^>]*\bclass="v-button"/);
  expect(button).toContain('data-variant="tinted"');
  expect(button).toContain('type="submit"');
  expect(button).toMatch(/>Save<\/button>$/);

  const link = String(
    <Button as="a" href="/clients" class="px-l">
      Clients
    </Button>,
  );
  expect(link).toMatch(/^<a[^>]*\bclass="v-button px-l"/);
  expect(link).toContain('href="/clients"');
  expect(link).toMatch(/>Clients<\/a>$/);
});

test("BarChart labels each column with its date", () => {
  const chart = String(
    <BarChart
      points={[
        { label: "2026-05-16", value: 5 },
        { label: "2026-05-17", value: 10 },
      ]}
      max={10}
    />,
  );
  expect(chart).toMatch(/<time[^>]*datetime="2026-05-16">2026-05-16<\/time>/);
  expect(chart).toMatch(/<time[^>]*datetime="2026-05-17">2026-05-17<\/time>/);
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

test("Icon is hidden from screen readers unless it's labelled", () => {
  expect(String(<Icon name="check" />)).toContain('aria-hidden="true"');
  const labelled = String(<Icon name="check" label="Done" />);
  expect(labelled).toContain('role="img" aria-label="Done"');
  expect(labelled).not.toContain("aria-hidden");
});

test("SummaryList drops falsy rows and stacks several values under one label", () => {
  const showTo = false;
  const html = String(
    <SummaryList
      rows={[
        { label: "Action", values: ["Delete rate"] },
        { label: "For", values: ["Erik Sjöberg", "Anna Lindqvist"] },
        showTo && { label: "To", values: ["31 December 2026"] },
      ]}
    />,
  );
  expect(html).toMatch(/<dt class="fs-s ink-subtle lh-snug">For<\/dt>/);
  expect(html).toContain("Erik Sjöberg");
  expect(html).toContain("Anna Lindqvist");
  expect(html).toContain("b-none:last-child");
  expect(html).not.toContain("31 December 2026");
});

test("SummaryList renders row actions as links, and drops the ones not allowed", () => {
  const canChange = false;
  const html = String(
    <SummaryList
      rows={[
        { label: "Name", values: ["Acme"], action: { label: "Edit", href: "/clients/1/edit" } },
        { label: "Number", values: ["None"], action: canChange && { label: "Add", href: "/" } },
      ]}
    />,
  );
  expect(html).toContain('<a class="v-link fs-s" href="/clients/1/edit">Edit</a>');
  expect(html).not.toContain(">Add</a>");
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
  expect(grid).toMatch(/<span[^>]*ta-right[^>]*>Hours<\/span>/);
  expect(grid).not.toContain("Missing");
  expect(grid).toMatch(/>Ada<\/span><span[^>]*ta-right[^>]*>7,5 h<\/span><\/a>/);
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

test("ListSummary writes out up to three items, then names the first and counts the rest", () => {
  expect(String(<ListSummary items={[]} />)).toBe("");
  expect(String(<ListSummary items={["Oslo", "Bergen", "Trondheim"]} />)).toBe(
    "Oslo, Bergen, Trondheim",
  );
  expect(String(<ListSummary items={["Oslo", "Bergen", "Trondheim", "Stavanger"]} />)).toBe(
    "Oslo +3 more",
  );
  expect(
    String(
      <ListSummary shown={2} items={["Oslo", "Bergen", "Trondheim", "Stavanger", "Tromsø"]} />,
    ),
  ).toBe("Oslo, Bergen +3 more");
});
