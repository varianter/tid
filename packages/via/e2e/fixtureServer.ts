import { attributes, layerTemplateId } from "../src/attributes";

// Pages that each take via down one path, so its tests don't depend on the app's pages.

const build = await Bun.build({ entrypoints: [`${import.meta.dir}/../src/index.ts`] });
const [script] = build.outputs;
if (!build.success || !script) throw new AggregateError(build.logs, "Bundling via failed");
const scriptCode = await script.text();

/** A page; `form` marks it as a form, which a submission that ends on it stays layered for. */
function page(title: string, content: string, { status = 200, form = false } = {}) {
  const html = `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <script type="module" src="/via.js"></script>
  </head>
  <body>
    <main ${form ? attributes.formPage : ""}>${content}</main>
    <template id="${layerTemplateId}">
      <div popover role="dialog" tabindex="-1"><div ${attributes.layerContent}></div></div>
    </template>
  </body>
</html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html" } });
}

function homePage(request: Request) {
  const saved = new URL(request.url).searchParams.has("saved");
  return page(
    "Home",
    `<h1>Home</h1>
    ${saved ? "<p>Saved</p>" : ""}
    <a ${attributes.layer} href="/form">Open the form</a>
    <a ${attributes.layer} href="/leave">Open a form that ends on a page to read</a>`,
  );
}

// Saving goes back to the home page, which accepts the layer. An empty note fails, like a form
// with errors.
function formPage(request: Request, failed = false) {
  const added = new URL(request.url).searchParams.has("added");
  return page(
    "Form",
    `<h1>Form</h1>
    ${added ? "<p>Added</p>" : ""}
    <form method="post">
      <input name="note" aria-label="Note" autofocus ${failed ? 'aria-invalid="true"' : ""}>
      <button>Save</button>
      <button formaction="/next">Next step</button>
      <button formaction="/proxy-error">Save past a failing proxy</button>
      <button formaction="/slow">Save slowly</button>
      <a ${attributes.layer} href="/nested">Add a choice</a>
      <a ${attributes.dismiss} href="/">Cancel</a>
    </form>`,
    { status: failed ? 422 : 200, form: true },
  );
}

/** How many times each slow submission was posted. */
export const slowSubmissions = { count: 0 };

export const server = Bun.serve({
  port: 0,
  routes: {
    "/via.js": new Response(scriptCode, { headers: { "Content-Type": "text/javascript" } }),
    // Chrome asks for one, and a 404 shows as a console error.
    "/favicon.ico": new Response(null, { status: 204 }),
    "/": homePage,
    "/form": {
      GET: (request) => formPage(request),
      POST: async (request) => {
        const note = (await request.formData()).get("note");
        return note ? Response.redirect("/?saved", 303) : formPage(request, true);
      },
    },
    "/next": { POST: () => Response.redirect("/step", 303) },
    "/step": () => page("Step", "<h1>Step</h1>", { form: true }),
    "/proxy-error": {
      POST: () =>
        new Response("Bad gateway", { status: 502, headers: { "Content-Type": "text/plain" } }),
    },
    // Long enough to press the button again before it answers.
    "/slow": {
      POST: async () => {
        slowSubmissions.count++;
        await Bun.sleep(500);
        return Response.redirect("/?saved", 303);
      },
    },
    // Opened from the form's layer, and arrives back on the form.
    "/nested": {
      GET: () =>
        page("Nested", `<h1>Nested</h1><form method="post"><button>Add</button></form>`, {
          form: true,
        }),
      POST: () => Response.redirect("/form?added", 303),
    },
    // Ends on a page to read that isn't the one below, like what it created.
    "/leave": {
      GET: () =>
        page("Leave", `<h1>Leave</h1><form method="post"><button>Go</button></form>`, {
          form: true,
        }),
      POST: () => Response.redirect("/created", 303),
    },
    "/created": () => page("Created", "<h1>Created</h1>"),
  },
});
