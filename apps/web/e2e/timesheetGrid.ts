/** A cell on the user's timesheet with no hours that they can log on. */
export async function findEmptyCell(view: Bun.WebView) {
  const selector = "form[data-cell][data-minutes='0']:has(input:not([disabled]))";
  const { taskId, day } = (await view.evaluate(
    `(({ dataset }) => ({ taskId: Number(dataset.task), day: dataset.day }))(document.querySelector("${selector}"))`,
  )) as { taskId: number; day: string };
  return { taskId, day, input: `${selector} input[name=hours]` };
}
