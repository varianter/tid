// Only employees may sign up, and their email domain tells which country's offices they can
// choose between.
const countryByDomain = new Map([
  ["variant.no", "NO"],
  ["variant.se", "SE"],
]);

export function employeeCountry(email: string) {
  const [, domain, ...rest] = email.toLowerCase().split("@");
  return domain && rest.length === 0 ? countryByDomain.get(domain) : undefined;
}
