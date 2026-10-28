import { expect, test } from "bun:test";
import { BarChart, Button, DataGrid, FormField, Tabs } from "./index";

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

test("BarChart sizes bars against max and labels each column with its date", () => {
  const chart = String(
    <BarChart
      points={[
        { label: "2026-05-16", value: 5 },
        { label: "2026-05-17", value: 10 },
      ]}
      max={10}
    />,
  );
  expect(chart).toContain("grid-template-columns: repeat(2, 1fr);");
  expect(chart).toContain('style="height: 50%;"');
  expect(chart).toContain('style="height: 100%;"');
  expect(chart).toMatch(/<time[^>]*datetime="2026-05-16">2026-05-16<\/time>/);
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
