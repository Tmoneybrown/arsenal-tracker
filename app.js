(function () {
  "use strict";

  var boot = document.getElementById("boot");
  var sections = document.getElementById("sections");

  if (location.protocol === "file:") {
    showBoot(
      "Open this page through a local server so data.json can load. From the repo folder run: python3 -m http.server 8080 — then visit http://localhost:8080",
      true
    );
    return;
  }

  load();

  function load() {
    fetch("data.json", { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("data.json returned " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        assertData(data);
        render(data);
        boot.hidden = true;
        sections.hidden = false;
        watchNav();
      })
      .catch(function (error) {
        showBoot("Could not load data.json. " + error.message, true);
      });
  }

  function assertData(data) {
    ["arsenal", "ammo", "wishlist", "carry", "magMap", "notes"].forEach(function (key) {
      if (!data || data[key] == null) {
        throw new Error('missing "' + key + '"');
      }
    });
    if (!data.wishlist.tiers || !data.wishlist.nonGlock) {
      throw new Error("wishlist tiers or non-Glock list is missing");
    }
  }

  function render(data) {
    if (data.meta && data.meta.title) {
      document.title = data.meta.title;
    }
    var tagline = document.querySelector(".tagline");
    if (tagline && data.meta && data.meta.tagline) {
      tagline.textContent = data.meta.tagline;
    }
    fill("arsenal", function () {
      return renderArsenal(data);
    });
    fill("accessories", function () {
      return renderAccessories(data);
    });
    fill("ammo", function () {
      return renderAmmo(data);
    });
    fill("wishlist", function () {
      return renderWishlist(data);
    });
    fill("carry", function () {
      return renderCarry(data);
    });
    fill("mag-map", function () {
      return renderMagMap(data);
    });
    fill("notes", function () {
      return renderNotes(data);
    });
  }

  function fill(name, builder) {
    var mount = document.querySelector('[data-mount="' + name + '"]');
    if (!mount) return;
    mount.replaceChildren();
    try {
      var node = builder();
      if (node) mount.append(node);
    } catch (error) {
      mount.append(el("p", { class: "error", text: "Could not render this section. " + error.message }));
    }
  }

  function renderArsenal(data) {
    var guns = data.arsenal || [];
    if (!guns.length) {
      return el("p", { class: "prose", text: "No owned guns entered." });
    }
    return el("div", { class: "cards cols-2" }, guns.map(renderGun));
  }

  function renderAccessories(data) {
    var gear = data.gear || [];
    if (!gear.length) {
      return el("p", { class: "prose", text: "No accessories entered." });
    }
    return el("div", { class: "cards cols-2" }, gear.map(renderGear));
  }

  function renderGear(item) {
    return el("article", { class: "card" }, [
      el("div", { class: "card-top" }, [
        el("h3", { class: "card-title", text: item.name }),
        statusTag(item.status)
      ]),
      el("p", { class: "meta-line" }, [
        "Brand ",
        item.brand ? el("span", { text: item.brand }) : el("span", { class: "tag tag-tbd", text: "TBD" })
      ])
    ]);
  }

  function renderGun(gun) {
    var meta = [gun.caliber, gun.action, gun.role].filter(Boolean).join(" · ");
    return el("article", { class: "card" }, [
      el("div", { class: "card-top" }, [
        el("h3", { class: "card-title", text: gun.name }),
        statusTag(gun.status)
      ]),
      meta ? el("p", { class: "meta-line", text: meta }) : null,
      gun.details && gun.details.length ? list(gun.details) : null,
      gun.needs && gun.needs.length
        ? el("div", {}, [
          el("p", { class: "needs-label", text: "Needs" }),
          el("div", { class: "chips" }, gun.needs.map(function (need) {
            return el("span", { class: "chip", text: need });
          }))
        ])
        : null
    ]);
  }

  function renderAmmo(data) {
    var guns = data.ammo || [];
    if (!guns.length) {
      return el("p", { class: "lead", text: "No owned guns to track." });
    }
    return el("div", { class: "stack" }, guns.map(renderAmmoGun));
  }

  function renderAmmoGun(gun) {
    var loads = gun.loads || [];
    return el("article", { class: "card" }, [
      el("div", { class: "card-top" }, [
        el("h3", { class: "card-title", text: gun.gun || "Gun" }),
        gun.caliber ? el("span", { class: "tag tag-tan", text: gun.caliber }) : null
      ]),
      el("div", { class: "load-list" }, loads.map(renderAmmoBar)),
      gun.notes && gun.notes.length
        ? el("ul", { class: "clean load-notes" }, gun.notes.map(function (note) {
          return el("li", { text: note });
        }))
        : null
    ]);
  }

  function renderAmmoBar(load) {
    var known = load.known === true;
    var count = num(load.count);
    var goal = load.goal == null ? 1000 : num(load.goal);
    var pct = known && goal > 0 ? Math.min(100, (count / goal) * 100) : 0;
    var label = load.label || "Ammo";
    var fill = /range/i.test(label) ? "meter-practice" : "meter-defensive";
    return el("div", { class: "load" }, [
      el("div", { class: "meter-head" }, [
        el("strong", { text: label }),
        el("span", { class: "meter-tools" }, [
          known ? null : el("span", { class: "tag tag-unknown", text: "Unknown" }),
          el("span", { class: "meter-scale", text: (known ? formatCount(count) : "0") + " / " + formatCount(goal) })
        ])
      ]),
      el("div", {
        class: "meter",
        role: "progressbar",
        "aria-valuemin": "0",
        "aria-valuemax": String(goal),
        "aria-valuenow": String(known ? count : 0),
        "aria-label": label + " versus goal"
      }, [
        el("span", { class: fill, style: "width:" + pct + "%" })
      ]),
      load.load ? el("p", { class: "load-name", text: load.load }) : null
    ]);
  }

  function renderWishlist(data) {
    var root = el("div", {});
    var total = renderKnownTotal(data);
    if (total) root.append(total);
    (data.wishlist.tiers || []).forEach(function (tier) {
      var items = (tier.items || []).filter(function (item) { return !isPistolWishItem(item); });
      if (!items.length) return;
      root.append(renderWishGroup(
        tier.label + " " + tier.name,
        items,
        itemKnownPrice,
        renderWishRow
      ));
    });
    var pistols = collectPistols(data);
    if (pistols.length) {
      root.append(renderWishGroup("Pistols", pistols, pistolRowPrice, renderPistolRow));
    }
    return root;
  }

  function isPistolWishItem(item) {
    if (!item || item.kind !== "build") return false;
    var name = ((item.shortName || "") + " " + (item.name || "")).toLowerCase();
    return !/rifle|shotgun|carbine|ar-15|sub-2000/.test(name);
  }

  function collectPistols(data) {
    var builds = [];
    var alts = [];
    (data.wishlist.tiers || []).forEach(function (tier) {
      (tier.items || []).forEach(function (item) {
        if (!isPistolWishItem(item)) return;
        builds.push(item);
        (item.alternatives || []).forEach(function (alt) {
          if (!alt || !alt.name) return;
          alts.push({
            kind: "pistol-alt",
            name: alt.name,
            priceLow: alt.priceLow,
            priceRecommended: alt.priceRecommended,
            alternateTo: item.shortName || item.name,
            excludeFromSubtotal: true
          });
        });
      });
    });
    ((data.carry && data.carry.contenders) || []).forEach(function (gun) {
      if (!gun || !gun.name) return;
      var match = null;
      alts.concat(builds).forEach(function (row) {
        if (sameGun(row.name, gun.name) || sameGun(row.shortName, gun.name)) match = row;
      });
      if (match) match.carry = gun;
    });
    alts.sort(function (a, b) {
      var ap = a.carry && a.carry.topPick ? 0 : 1;
      var bp = b.carry && b.carry.topPick ? 0 : 1;
      return ap - bp;
    });
    var others = ((data.wishlist.nonGlock && data.wishlist.nonGlock.items) || []).map(function (item) {
      return {
        kind: "non-glock",
        name: item.name,
        gunPrice: item.gunPrice,
        buildEstimate: item.buildEstimate
      };
    });
    return builds.concat(alts, others);
  }

  function pistolRowPrice(item) {
    if (!item || item.excludeFromSubtotal) return null;
    if (item.kind === "build" || item.kind === "pistol-alt") {
      return isFiniteNumber(item.priceLow) ? item.priceLow : null;
    }
    if (item.kind === "non-glock") return isFiniteNumber(item.gunPrice) ? item.gunPrice : null;
    return itemKnownPrice(item);
  }

  function renderWishGroup(title, items, priceOf, renderRow) {
    var sub = groupSubtotal(items, priceOf);
    return el("section", { class: "wish-group", "aria-label": title }, [
      el("h3", { class: "wish-heading", text: title }),
      el("div", { class: "wish-rows" }, items.map(renderRow)),
      el("p", { class: "wish-subtotal" }, [
        el("span", { text: "Subtotal" }),
        sub.complete
          ? el("span", { class: "price", text: formatMoney(sub.amount, { plus: sub.plus }) })
          : el("span", { class: "tag tag-tbd", text: "TBD" })
      ])
    ]);
  }

  function groupSubtotal(items, priceOf) {
    var cents = 0;
    var known = 0;
    var missing = false;
    items.forEach(function (item) {
      if (item && item.excludeFromSubtotal) return;
      var amount = priceOf(item);
      if (amount == null) {
        missing = true;
        return;
      }
      known += 1;
      cents += Math.round(amount * 100);
    });
    if (!known) return { complete: false, amount: null, plus: false };
    return { complete: true, amount: cents / 100, plus: missing };
  }

  function itemKnownPrice(item) {
    if (!item) return null;
    if (item.kind === "build") return isFiniteNumber(item.priceLow) ? item.priceLow : null;
    if (item.kind === "offers") return lowestOfferPrice(item);
    return isFiniteNumber(item.price) ? item.price : null;
  }

  function lowestOfferPrice(item) {
    var offer = lowestOffer(item);
    return offer ? offer.price : null;
  }

  function lowestOffer(item) {
    var best = null;
    (item.offers || []).forEach(function (offer) {
      if (!isFiniteNumber(offer.price)) return;
      if (!best || offer.price < best.price) best = offer;
    });
    return best;
  }

  function renderWishRow(item) {
    var price = itemKnownPrice(item);
    var href = wishHref(item);
    var note = wishNote(item);
    var name = href
      ? el("a", {
        class: "wish-name",
        href: href,
        target: "_blank",
        rel: "noopener noreferrer",
        text: item.name
      })
      : el("span", { class: "wish-name", text: item.name });
    return el("article", { class: "wish-row" }, [
      el("div", { class: "wish-id" }, [
        name,
        statusTag(item.status),
        item.planned ? el("span", { class: "tag tag-olive", text: "Planned" }) : null
      ]),
      el("div", { class: "wish-price" }, [
        price == null
          ? el("span", { class: "tag tag-tbd", text: "TBD" })
          : el("span", { class: "price", text: formatMoney(price) }),
        rowPriceLabel(item, price)
      ]),
      note ? el("p", { class: "wish-note", text: note }) : null,
      wishDetails(item, note)
    ]);
  }

  function renderPistolRow(item) {
    if (item.kind === "build") return renderWishRow(item);
    if (item.kind === "pistol-alt") return renderPistolAltRow(item);
    return renderNonGlockRow(item);
  }

  function renderPistolAltRow(item) {
    var price = isFiniteNumber(item.priceLow) ? item.priceLow : null;
    var note = pistolAltNote(item);
    return el("article", { class: "wish-row" }, [
      el("div", { class: "wish-id" }, [
        el("span", { class: "wish-name", text: item.name }),
        item.carry && item.carry.topPick ? el("span", { class: "badge badge-olive", text: "Top pick" }) : null
      ]),
      el("div", { class: "wish-price" }, [
        price == null
          ? el("span", { class: "tag tag-tbd", text: "TBD" })
          : el("span", { class: "price", text: formatMoney(price) }),
        price == null ? null : el("span", { class: "price-label", text: "Low" })
      ]),
      note ? el("p", { class: "wish-note", text: note }) : null,
      el("details", { class: "wish-details" }, [
        el("summary", { text: "Details" }),
        el("div", { class: "wish-detail-body" }, [
          el("div", { class: "price-pair" }, [
            priceBlock("Low", item.priceLow),
            priceBlock("Recommended", item.priceRecommended)
          ])
        ])
      ])
    ]);
  }

  function pistolAltNote(item) {
    var bits = [];
    if (item.carry && item.carry.topPick) bits.push("Carry top pick");
    else if (item.carry) bits.push("Carry option");
    if (item.alternateTo) bits.push("Alternate to the " + item.alternateTo);
    return bits.join(". ") + (bits.length ? "." : "");
  }

  function renderNonGlockRow(item) {
    var note = "Doesn't share mags with the SUB-2000.";
    if (isFiniteNumber(item.buildEstimate)) {
      note += " Approx. build " + formatMoney(item.buildEstimate, { approx: true }) + ".";
    }
    return el("article", { class: "wish-row" }, [
      el("div", { class: "wish-id" }, [
        el("span", { class: "wish-name", text: item.name })
      ]),
      el("div", { class: "wish-price" }, [
        isFiniteNumber(item.gunPrice)
          ? el("span", { class: "price", text: formatMoney(item.gunPrice) })
          : el("span", { class: "tag tag-tbd", text: "TBD" }),
        isFiniteNumber(item.gunPrice) ? el("span", { class: "price-label", text: "Gun" }) : null
      ]),
      el("p", { class: "wish-note", text: note })
    ]);
  }

  function rowPriceLabel(item, price) {
    if (price == null) return null;
    if (item.kind === "build") return el("span", { class: "price-label", text: "Low" });
    if (item.kind === "offers") return el("span", { class: "price-label", text: "Lowest" });
    return null;
  }

  function wishHref(item) {
    if (item.kind === "offers") {
      var best = lowestOffer(item);
      return best ? safeUrl(best.url) : null;
    }
    return safeUrl(item.url);
  }

  function wishNote(item) {
    if (item.kind === "build") return item.planned ? "Next planned buy" : "";
    if (item.summary) return firstSentence(item.summary);
    if (item.caliber) return item.caliber;
    if (item.details && item.details.length) return item.details.join(", ");
    return "";
  }

  function firstSentence(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) return "";
    var match = trimmed.match(/^.+?[.!?](?=\s|$)/);
    var sentence = match ? match[0] : trimmed;
    if (sentence.length > 140) return sentence.slice(0, 137).trim() + "…";
    return sentence;
  }

  function wishDetails(item, note) {
    var parts = [];
    if (item.kind === "build") {
      parts.push(el("div", { class: "price-pair" }, [
        priceBlock("Low", item.priceLow),
        priceBlock("Recommended", item.priceRecommended)
      ]));
      if (item.components && item.components.length) {
        parts.push(el("ul", { class: "component-list" }, item.components.map(function (part) {
          return el("li", {}, [
            el("span", { text: part.name }),
            part.price == null ? el("span", { class: "tag tag-tbd", text: "TBD" }) : el("span", { class: "price", text: formatMoney(part.price) })
          ]);
        })));
      }
      if (item.priceNote) parts.push(el("p", { class: "note", text: item.priceNote }));
      var rows = [{
        name: item.shortName || item.name,
        priceLow: item.priceLow,
        priceRecommended: item.priceRecommended,
        planned: true
      }].concat(item.alternatives || []);
      if (rows.length > 1) {
        parts.push(el("h4", { class: "needs-label", text: "Alternate pistols, build totals" }));
        parts.push(buildTable(rows));
      }
    } else if (item.kind === "offers") {
      if (item.summary && item.summary.trim() !== note) {
        parts.push(el("p", { class: "prose", text: item.summary }));
      }
      parts.push(renderOfferList(item));
    } else {
      if (item.summary && item.summary.trim() !== note) {
        parts.push(el("p", { class: "prose", text: item.summary }));
      }
      if (item.details && item.details.length && item.details.join(", ") !== note) {
        parts.push(list(item.details));
      }
      if (item.caliber && note !== item.caliber) {
        parts.push(el("p", { class: "meta-line", text: item.caliber }));
      }
    }
    if (!parts.length) return null;
    return el("details", { class: "wish-details" }, [
      el("summary", { text: "Details" }),
      el("div", { class: "wish-detail-body" }, parts)
    ]);
  }

  function renderOfferList(item) {
    var lowest = lowestOfferPrice(item);
    return el("div", { class: "offer-list" }, (item.offers || []).map(function (offer) {
      var href = safeUrl(offer.url);
      var body = [
        el("span", {}, [
          el("span", { class: "offer-vendor", text: offer.vendor }),
          href ? el("span", { class: "offer-host", text: hostOf(href) }) : null
        ]),
        el("span", { class: "offer-price" }, [
          moneyNode(offer.price),
          lowest != null && offer.price === lowest
            ? el("span", { class: "tag tag-olive", text: "Lowest listed" })
            : null
        ])
      ];
      if (!href) return el("div", { class: "offer-row" }, body);
      return el("a", {
        class: "offer-row",
        href: href,
        target: "_blank",
        rel: "noopener noreferrer"
      }, body);
    }));
  }

  function renderCarry(data) {
    var carry = data.carry || {};
    var contenders = carry.contenders || [];
    var pair = contenders.map(function (gun, index) {
      var card = el("article", { class: "card" + (gun.topPick ? " top-pick" : "") }, [
        el("div", { class: "card-top" }, [
          el("h3", { class: "card-title", text: gun.name }),
          gun.topPick ? el("span", { class: "badge badge-olive", text: "Top pick" }) : null
        ]),
        gun.capacity ? el("p", { class: "stat-value stat-text", text: gun.capacity }) : null,
        gun.points && gun.points.length ? list(gun.points) : null
      ]);
      if (index === 0 && contenders.length > 1) {
        return [card, el("p", { class: "vs", text: "vs" })];
      }
      return card;
    });
    return el("div", {}, [
      carry.summary ? el("p", { class: "lead", text: carry.summary }) : null,
      carry.pricesNote ? el("p", { class: "note", text: carry.pricesNote }) : null,
      el("div", { class: "compare" }, pair),
      (carry.alternatives || []).length
        ? el("h3", { class: "needs-label", text: "Also considered" })
        : null,
      (carry.alternatives || []).length
        ? el("ul", { class: "alt-list" }, carry.alternatives.map(function (name) {
          return el("li", { text: name });
        }))
        : null
    ]);
  }

  function renderMagMap(data) {
    var map = data.magMap || {};
    var groups = {};
    (map.groups || []).forEach(function (group) {
      groups[group.id] = group;
    });
    var ownedNames = ownedGunNames(data);
    var wishNames = wishlistGunNames(data);
    var owned = [];
    var wished = [];
    (map.rows || []).forEach(function (row) {
      if (namesMatch(row.gun, ownedNames)) owned.push(row);
      else if (namesMatch(row.gun, wishNames)) wished.push(row);
    });
    return el("div", { class: "stack" }, [
      map.intro ? el("p", { class: "lead", text: map.intro }) : null,
      el("div", { class: "legend" }, (map.groups || []).map(function (group) {
        return el("span", { class: "legend-item" }, [
          groupTag(group),
          el("span", { text: group.detail || "" })
        ]);
      })),
      renderMagBlock("Owned", "mag-owned", owned, groups),
      renderMagBlock("Wishlist", "mag-wishlist", wished, groups)
    ]);
  }

  function renderMagBlock(title, id, rows, groups) {
    return el("section", { class: "map-block", "aria-labelledby": id }, [
      el("h3", { id: id, text: title }),
      rows.length
        ? magTable(rows, groups)
        : el("p", { class: "prose", text: "None listed." })
    ]);
  }

  function magTable(rows, groups) {
    return el("div", { class: "table-scroll" }, [
      el("table", {}, [
        el("thead", {}, [
          el("tr", {}, ["Gun", "Group", "Caliber", "Magazine", "Shares mags with"].map(function (label) {
            return el("th", { scope: "col", text: label });
          }))
        ]),
        el("tbody", {}, rows.map(function (row) {
          var group = groups[row.group] || { label: row.group || "", tone: "tan" };
          return el("tr", {}, [
            el("th", { scope: "row", text: row.gun }),
            el("td", {}, [groupTag(group)]),
            el("td", { text: row.caliber }),
            el("td", { text: row.magazine }),
            el("td", { text: row.sharesMagsWith })
          ]);
        }))
      ])
    ]);
  }

  function ownedGunNames(data) {
    return (data.arsenal || []).filter(function (gun) {
      return String(gun.status || "").toLowerCase() === "owned";
    }).map(function (gun) { return gun.name; });
  }

  function wishlistGunNames(data) {
    var names = [];
    var listed = [];
    ((data.wishlist && data.wishlist.tiers) || []).forEach(function (tier) {
      (tier.items || []).forEach(function (item) {
        if (item.name) listed.push(item.name);
        if (item.shortName) listed.push(item.shortName);
        (item.alternatives || []).forEach(function (alt) {
          if (alt && alt.name) listed.push(alt.name);
        });
        if (isWishlistFirearm(item)) {
          if (item.shortName) names.push(item.shortName);
          if (item.name) names.push(item.name);
        }
      });
    });
    ((data.carry && data.carry.contenders) || []).forEach(function (gun) {
      if (gun && gun.name && namesMatch(gun.name, listed)) names.push(gun.name);
    });
    return names;
  }

  function isWishlistFirearm(item) {
    if (!item) return false;
    if (item.kind === "build" || item.kind === "offers") return true;
    return !!item.caliber;
  }

  function namesMatch(name, list) {
    return list.some(function (other) { return sameGun(name, other); });
  }

  function sameGun(a, b) {
    var x = normGun(a);
    var y = normGun(b);
    if (!x || !y) return false;
    if (x === y) return true;
    var shorter = x.length <= y.length ? x : y;
    var longer = x.length <= y.length ? y : x;
    return (" " + longer + " ").indexOf(" " + shorter + " ") !== -1;
  }

  function normGun(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function renderNotes(data) {
    var notes = data.notes || {};
    return el("div", {}, [
      el("div", { class: "law-list" }, (notes.items || []).map(function (item) {
        return el("article", { class: "card law-card" }, [
          el("h3", { text: item.title }),
          el("p", { class: "prose", text: item.text })
        ]);
      })),
      notes.lastChecked ? el("p", { class: "checked", text: "Last checked " + notes.lastChecked }) : null
    ]);
  }

  function buildTable(rows) {
    return el("div", { class: "table-scroll" }, [
      el("table", {}, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", { scope: "col", text: "Pistol" }),
            el("th", { scope: "col", text: "Low" }),
            el("th", { scope: "col", text: "Recommended" })
          ])
        ]),
        el("tbody", {}, rows.map(function (row) {
          return el("tr", {}, [
            el("th", { scope: "row" }, [
              document.createTextNode(row.name),
              row.planned ? el("span", { class: "tag tag-olive planned-flag", text: "Planned" }) : null
            ]),
            el("td", {}, [moneyNode(row.priceLow)]),
            el("td", {}, [moneyNode(row.priceRecommended)])
          ]);
        }))
      ])
    ]);
  }

  function renderKnownTotal(data) {
    var spec = data.wishlist && data.wishlist.knownTotal;
    if (!spec || !spec.parts) return null;
    var total = knownTotal(data);
    return el("article", { class: "card" }, [
      el("span", { class: "price-label", text: "Wishlist total of known prices" }),
      total.complete
        ? el("span", {
          class: "stat-value",
          "data-known-total": "true",
          text: formatMoney(total.amount, { plus: total.plus })
        })
        : el("span", { class: "tag tag-tbd", text: "TBD" })
    ]);
  }

  function knownTotal(data) {
    var spec = data.wishlist && data.wishlist.knownTotal;
    if (!spec || !spec.parts) return { complete: false, amount: null, plus: false };
    var cents = 0;
    for (var i = 0; i < spec.parts.length; i += 1) {
      var amount = partAmount(data, spec.parts[i]);
      if (amount == null) return { complete: false, amount: null, plus: !!spec.trailingPlus };
      cents += Math.round(amount * 100);
    }
    return {
      complete: true,
      amount: cents / 100,
      plus: !!spec.trailingPlus
    };
  }

  function partAmount(data, part) {
    var item = findItem(data, part.itemId);
    if (!item) return null;
    if (part.field === "priceLow" || part.field === "priceRecommended" || part.field === "price") {
      return isFiniteNumber(item[part.field]) ? Number(item[part.field]) : null;
    }
    if (part.field === "lowestOffer") {
      var prices = (item.offers || []).map(function (offer) { return offer.price; }).filter(isFiniteNumber);
      if (!prices.length) return null;
      return Math.min.apply(null, prices);
    }
    return null;
  }

  function findItem(data, id) {
    if (!id) return null;
    var tiers = (data.wishlist && data.wishlist.tiers) || [];
    for (var i = 0; i < tiers.length; i += 1) {
      var items = tiers[i].items || [];
      for (var j = 0; j < items.length; j += 1) {
        if (items[j].id === id) return items[j];
      }
    }
    return null;
  }

  function priceBlock(label, value) {
    return el("div", {}, [
      el("span", { class: "price-label", text: label }),
      moneyNode(value, { large: true })
    ]);
  }

  function moneyNode(value, options) {
    options = options || {};
    var text = formatMoney(value, options);
    if (!text) return el("span", { class: "tag tag-tbd", text: "TBD" });
    return el("span", { class: "price" + (options.large ? " price-lg" : ""), text: text });
  }

  function statusTag(status) {
    if (!status) return null;
    var slug = String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return el("span", { class: "tag tag-" + slug, text: status });
  }

  function groupTag(group) {
    return el("span", { class: "tag tag-" + (group.tone || "tan"), text: group.label || "" });
  }

  function list(items) {
    return el("ul", { class: "clean" }, items.map(function (item) {
      return el("li", { text: item });
    }));
  }

  function formatMoney(value, options) {
    options = options || {};
    if (!isFiniteNumber(value)) return null;
    var number = value;
    var whole = Math.round(number * 100) % 100 === 0;
    var digits = options.approx && whole ? 0 : 2;
    var text = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(number);
    return (options.approx ? "~" : "") + text + (options.plus ? "+" : "");
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(num(value));
  }

  function num(value) {
    var number = Number(value);
    return isFiniteNumber(number) ? number : 0;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function safeUrl(url) {
    if (typeof url !== "string" || !url) return null;
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (error) {
      return null;
    }
    return null;
  }

  function hostOf(url) {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch (error) {
      return "";
    }
  }

  function watchNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
    var nav = document.querySelector(".nav");

    function sectionFor(link) {
      return document.getElementById((link.getAttribute("href") || "").slice(1));
    }

    function mark(id) {
      links.forEach(function (link) {
        if ((link.getAttribute("href") || "") === "#" + id) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }

    function currentId() {
      var offset = (nav ? nav.offsetHeight : 0) + 24;
      var y = window.scrollY + offset;
      var id = (links[0] && (links[0].getAttribute("href") || "").slice(1)) || "";
      links.forEach(function (link) {
        var section = sectionFor(link);
        if (section && section.offsetTop <= y) id = section.id;
      });
      return id;
    }

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var section = sectionFor(link);
        if (!section) return;
        event.preventDefault();
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        if (history.pushState) history.pushState(null, "", link.getAttribute("href"));
        mark(section.id);
      });
    });

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        mark(currentId());
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  function showBoot(message, isError) {
    boot.hidden = false;
    boot.textContent = message;
    boot.classList.toggle("error", !!isError);
    boot.setAttribute("role", isError ? "alert" : "status");
    sections.hidden = true;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "style") node.setAttribute("style", value);
      else node.setAttribute(key, value);
    });
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children == null) return;
    var list = Array.isArray(children) ? children : [children];
    flatten(list).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
  }

  function flatten(list) {
    var out = [];
    list.forEach(function (item) {
      if (Array.isArray(item)) {
        item.forEach(function (inner) { out.push(inner); });
      } else {
        out.push(item);
      }
    });
    return out;
  }
})();
