import { Button, Page } from "@tid/ui";

export function ErrorPage({
  status,
  message,
  report,
}: {
  status: number;
  message: string;
  report?: string;
}) {
  return (
    <Page title={message}>
      <p class="ink-subtle">Error {status}</p>
      {report && (
        <>
          <p class="ink-subtle">
            This was unexpected. Please send the technical details below to the developers.
          </p>
          <pre class="fs-s b-all bc-subtle p-xs of-scroll">{report}</pre>
        </>
      )}
      <div>
        <Button as="a" href="/" data-variant="tinted">
          Go to timesheet
        </Button>
      </div>
    </Page>
  );
}
