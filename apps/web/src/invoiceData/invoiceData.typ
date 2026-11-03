// Lays out an `InvoiceData` from invoiceData.ts, which formats every value.
#let data = json(bytes(sys.inputs.data))
#let rule = 0.75pt + rgb("#cdcdcd")
#let margin = 28pt

#set document(title: data.title)
#set text(font: "Britti Sans", size: 10pt, number-type: "lining", number-width: "tabular")
#set strong(delta: 200)
#set page(
  paper: "a4",
  flipped: true,
  margin: (top: 36pt, x: margin, bottom: 72pt),
  // In the background, so it repeats on every page at the same distance from the edge.
  background: place(bottom + left, dx: margin, dy: -24pt, box(width: 100% - 2 * margin, {
    set text(size: 7pt)
    grid(
      columns: (1fr, auto),
      align: horizon,
      [Invoice data · #data.client · #data.period], image("variant-wordmark.svg", width: 67pt),
    )
  })),
)

#grid(
  columns: (1fr, auto),
  text(size: 40pt, weight: 600, tracking: -0.02em)[Invoice data],
  image("variant-symbol.svg", width: 28pt),
)
#v(48pt)

#grid(
  columns: 2,
  column-gutter: 8pt,
  row-gutter: 6pt,
  [Client], strong(data.client),
  [Project], strong(data.project),
  [Period], strong(data.period),
)
#v(24pt)

#{
  set text(size: 7pt)
  let days = data.days
  let last = days.len() + 1
  table(
    columns: (1fr, ..days.map(_ => 22pt), auto),
    align: (x, _) => if x == 0 { left + bottom } else { right + bottom },
    inset: (x, _) => (top: 6pt, bottom: 4pt, left: if x == 0 { 4pt } else { 2pt }, right: 4pt),
    fill: (_, y) => if y == 0 { rgb("#f4f4f4") },
    stroke: (x, y) => (left: if x > 0 { rule }, bottom: if y > 0 { rule }),
    table.header(
      strong[Name],
      ..days.map(day => strong(text(fill: if day.dayOff { rgb("#fe6d6d") } else { black }, day.label))),
      strong[Total],
    ),
    ..data.consultants.map(consultant => (consultant.name, ..consultant.days, strong(consultant.total))).flatten(),
    table.footer(repeat: false, strong[Total], ..data.totals.days.map(strong), strong(data.totals.total)),
  )
}

#if data.at("amount", default: none) != none {
  v(24pt)
  align(right)[Total amount #h(8pt) #strong(data.amount)]
}
