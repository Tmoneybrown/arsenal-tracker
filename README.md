# Arsenal & Wishlist

Static, single-page inventory for owned guns, the ammo stockpile, and the purchase wishlist. The page is plain HTML, CSS, and JavaScript with no build step. GitHub Pages serves it from `index.html` at the repository root.

Every count and price comes from [`data.json`](data.json). Update that file when the stockpile or the list changes. Leave `index.html`, `styles.css`, and `app.js` alone unless the layout itself needs to change.

Unknown prices render as **TBD**. The page does not estimate a price that is missing from `data.json`.

## Preview locally

`data.json` is loaded with `fetch`, so open the site through a local server (opening `index.html` as a file will not load the data):

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

## Edit data.json

Keep the file valid JSON: double quotes, no trailing commas, no comments. Array order is display order.

### Ammo counts

`ammo` lists only guns you own. Each gun has exactly two loads, `Defense ammo` and `Range ammo`. A load has `label`, `load` (the recommended round), `count`, `goal`, and `known`. While `known` is `false`, the page shows `0` and **Unknown**. Set `known` to `true` once the count is real. `notes` are short sentences under that gun.

### Owned guns

Add or edit objects in `arsenal`. `status` should be `"Owned"` for guns on hand. `needs` is a list of missing setup items; use `[]` when there is nothing outstanding.

Owned gear that is not a gun goes in `gear` and shows in My Accessories. Use `"brand": null` when the brand is unknown; the page shows TBD. Parts mounted on a gun stay in that gun's `details`, not in `gear`.

### Wishlist

`wishlist.tiers` is the priority list.

- `"kind": "item"` — a single price. Use `null` when the price is unknown (shown as TBD). `status` is `Researching`, `Saving`, or `Bought`.
- `"kind": "build"` — low and recommended totals, a component list, and alternate pistols. Put a component `price` only when you actually have that number.
- `"kind": "offers"` — vendor listings. Each offer has `vendor`, `price`, and `url`.

`wishlist.nonGlock` is the separate table of pistols that will not share magazines with the SUB-2000. `gunPrice` is the pistol; `buildEstimate` is shown with a tilde because those build totals are approximate.

### Carry, mag map, and notes

`carry` has no price fields. The renderer never prints a dollar amount there.

`magMap.groups` defines the colored group tags. Each `magMap.rows` entry points at a group with its `id`. The sentence in `magMap.intro` sits above the table.

`notes.items` are the law and policy notes. Bump `notes.lastChecked` when you re-read them. The notes page prints it as `Last checked <date>`.

## GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) deploys the repository root to GitHub Pages on every push to `main`, using the official static-site workflow.

One repository setting is required before the first deploy:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The site will be at `https://tmoneybrown.github.io/arsenal-tracker/` after a successful Actions run.
