import { Page } from "@tid/ui";

export function NotAnEmployeePage({ email }: { email: string }) {
  return (
    <Page title="Tid is for Variant employees">
      <p class="w-max-5">{email} isn't a Variant email address, so it can't be used to sign up.</p>
    </Page>
  );
}
