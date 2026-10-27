/**
 * Flips the page between light and dark, and remembers the choice in the `theme` cookie that the
 * layout reads before the page paints.
 */
class ThemeToggle extends HTMLElement {
  connectedCallback() {
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#onClick);
  }

  #onClick = () => {
    const root = document.documentElement;
    const theme = root.dataset.colorScheme === "dark" ? "light" : "dark";
    root.dataset.colorScheme = theme;
    // The page has already flipped, so a cookie that fails to save only costs the next page load.
    cookieStore
      .set({ name: "theme", value: theme, expires: Date.now() + 365 * 86_400_000, sameSite: "lax" })
      .catch(() => {});
  };
}

customElements.define("theme-toggle", ThemeToggle);
