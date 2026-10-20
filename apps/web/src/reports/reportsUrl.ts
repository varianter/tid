export const reportPath = (company: string, query: URLSearchParams) =>
  `/reports?${new URLSearchParams({ company })}&${query}`;
