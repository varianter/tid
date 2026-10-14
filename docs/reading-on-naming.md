# Reading on naming and structure

Background for the conventions in [`AGENTS.md`](../AGENTS.md) and [`apps/web/AGENTS.md`](../apps/web/AGENTS.md). If you read only one, read Belshee.

## Start here

- **Arlo Belshee, "Naming as a Process"** (blog series, Deep Roots). A method rather than a list of tips: a name moves from missing, through nonsense and honest, to a domain abstraction, one step at a time. A name that needs "and" is a sign the code wants to split.
- **Martin Fowler, [PresentationDomainDataLayering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html).** Layers are fine inside a module, but top-level modules should follow the domain. Why we have feature folders, not `routes/` and `views/`.
- **Robert C. Martin, [Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html).** The folder tree should tell you what the system does, not which framework it uses.

## Martin Fowler's bliki

- [UbiquitousLanguage](https://martinfowler.com/bliki/UbiquitousLanguage.html): name things in the words the users use.
- [BoundedContext](https://martinfowler.com/bliki/BoundedContext.html): the same word can mean different things in different parts of a system.
- [CommandQuerySeparation](https://martinfowler.com/bliki/CommandQuerySeparation.html) and [CQRS](https://martinfowler.com/bliki/CQRS.html): where commands and queries come from, and a warning about taking CQRS further than you need.
- [TwoHardThings](https://martinfowler.com/bliki/TwoHardThings.html): the quote.
- *Refactoring* (2nd edition): the renaming refactorings and the "Mysterious Name" smell.

## Foundations

- **David Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules" (1972).** Where "group by reason to change" comes from: a module hides one decision that's likely to change.
- **Eric Evans, *Domain-Driven Design*.** The chapters on ubiquitous language and modules: modules are named after domain concepts and their names become part of the language.
- **Kent Beck, *Tidy First?*** Cohesion and coupling as an economic choice, and when to move code.
- **Jimmy Bogard, [Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/).** The post most vertical slice writing builds on.
- **Oskar Dudycz, [on vertical slices and CQRS](https://www.architecture-weekly.com/p/my-thoughts-on-vertical-slices-cqrs)** (Architecture Weekly).

## Names in code

- **Robert C. Martin, *Clean Code*, chapter 2, "Meaningful Names".**
- **Felienne Hermans, *The Programmer's Brain*.** The chapter on naming draws on research into how developers choose and read names, and why consistent patterns help readers more than clever names.
- **Kevlin Henney, "Seven Ineffective Coding Habits of Many Programmers"** (talk). On why `Manager`, `Helper` and `Utils` say nothing.
