import { Button, Page } from "@tid/ui";
import { Hono } from "hono";

export const projects = new Hono();

projects.get("/", (c) =>
  c.render(
    <Page
      title="Projects"
      actions={
        <Button type="button" data-variant="tinted">
          New project
        </Button>
      }
    />,
  ),
);
