/* To find an icon and its name:
 * 1. go to https://fonts.google.com/icons?icon.style=Rounded
 * 2. click an icon and it should open a drawer with informaton.
 * 3. Scroll to the bottom of the drawer and copy the Icon name
 * 4. Insert in the array below and run `download-icons` from package root.
 * 5. Icon is downloaded to `./icons`. Profit!
 *
 * It is worth noting that the SVG will indeed be added to git. At this point, we're really OK with this.
 * If this becomes a problem, it could move to runtime instead. Fetch when needed and then stored.
 **/

export const iconNames = [
  "admin_panel_settings",
  "analytics",
  "bar_chart",
  "calendar_today",
  "check",
  "chevron_left",
  "chevron_right",
  "close",
  "dark_mode",
  "error",
  "event_available",
  "folder",
  "group",
  "handshake",
  "light_mode",
  "lock",
  "lock_open",
  "menu",
  "receipt_long",
  "settings",
  "table",
  "thumb_down",
  "thumb_up",
] as const;

export type IconName = (typeof iconNames)[number];
